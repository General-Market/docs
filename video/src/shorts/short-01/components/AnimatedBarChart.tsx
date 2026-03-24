import React from "react";
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { COLORS } from "../types";

/* ─── constants ────────────────────────────────── */
const GROWTH_GREEN = COLORS.GROWTH_GREEN; // "#00FF88"
const BG_BASE = COLORS.BG_BASE; // "#0A0A0A"

const CHART_W = 950;
const CHART_H = 650;
const PADDING_LEFT = 80;
const PADDING_TOP = 70;
const PADDING_RIGHT = 40;
const PADDING_BOTTOM = 70;
const INNER_W = CHART_W - PADDING_LEFT - PADDING_RIGHT;
const INNER_H = CHART_H - PADDING_TOP - PADDING_BOTTOM;

const FONT =
  "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

const Y_TICKS = [0, 10, 20, 25, 33]; // percentage labels
const MAX_Y = 40; // chart y-axis max for spacing


/* ─── helpers ──────────────────────────────────── */
function yPos(pct: number): number {
  return INNER_H - (pct / MAX_Y) * INNER_H;
}

/* ─── subcomponents ────────────────────────────── */

/** Subtle grid lines (TradingView dark theme feel) */
const GridLines: React.FC = () => {
  const gridColor = "rgba(255,255,255,0.09)";
  const vertLines = 5; // vertical grid cols
  return (
    <>
      {/* Horizontal grid at each Y tick */}
      {Y_TICKS.map((tick) => {
        const y = PADDING_TOP + yPos(tick);
        return (
          <div
            key={`h-${tick}`}
            style={{
              position: "absolute",
              left: PADDING_LEFT,
              top: y,
              width: INNER_W,
              height: 2,
              background: gridColor,
            }}
          />
        );
      })}
      {/* Vertical grid */}
      {Array.from({ length: vertLines }).map((_, i) => {
        const x = PADDING_LEFT + (INNER_W / (vertLines - 1)) * i;
        return (
          <div
            key={`v-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: PADDING_TOP,
              width: 2,
              height: INNER_H,
              background: gridColor,
            }}
          />
        );
      })}
    </>
  );
};

/** Y-axis labels on left */
const YAxis: React.FC = () => (
  <>
    {Y_TICKS.map((tick) => {
      const y = PADDING_TOP + yPos(tick);
      return (
        <div
          key={tick}
          style={{
            position: "absolute",
            right: CHART_W - PADDING_LEFT + 12,
            top: y - 10,
            fontSize: 16,
            fontFamily: FONT,
            color: "rgba(255,255,255,0.4)",
            textAlign: "right",
            width: 55,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {tick}%
        </div>
      );
    })}
  </>
);

/** LIVE badge blinking */
const LiveBadge: React.FC<{ frame: number; fps: number }> = ({
  frame,
  fps,
}) => {
  const blink = Math.sin((frame / fps) * Math.PI * 3) > 0 ? 1 : 0.3;
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        right: 20,
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: blink,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#FF3B3B",
          boxShadow: "0 0 10px #FF3B3B, 0 0 20px rgba(255,59,59,0.4)",
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontSize: 18,
          fontWeight: 700,
          color: "#FF3B3B",
          letterSpacing: 2,
        }}
      >
        LIVE
      </span>
    </div>
  );
};

/** Title header */
const ChartTitle: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 18,
      left: PADDING_LEFT,
      fontFamily: FONT,
      fontSize: 22,
      fontWeight: 600,
      color: "rgba(255,255,255,0.55)",
      letterSpacing: 4,
      textTransform: "uppercase",
      fontVariant: "small-caps",
    }}
  >
    Gen Z Sportsbook Adoption
  </div>
);

/* ─── GROWTH DELTA INDICATOR ──────────────────── */
interface GrowthDeltaProps {
  x1: number; // center x of 2024 bar
  x2: number; // center x of 2025 bar
  pct2024: number;
  pct2025: number;
  progress: number; // 0-1 animation progress
  frame: number;
  fps: number;
}

const GrowthDelta: React.FC<GrowthDeltaProps> = ({
  x1,
  x2,
  pct2024,
  pct2025,
  progress,
  frame,
  fps,
}) => {
  if (progress < 0.01) return null;

  const deltaPct = Math.round(((pct2025 - pct2024) / pct2024) * 100);
  const midX = (x1 + x2) / 2;
  const arrowY = PADDING_TOP + yPos(pct2025) - 80;

  // pulsing glow
  const pulse = 0.7 + 0.3 * Math.sin((frame / fps) * Math.PI * 2.5);

  return (
    <div
      style={{
        position: "absolute",
        left: midX - 70,
        top: arrowY,
        width: 140,
        textAlign: "center",
        opacity: progress,
        transform: `translateY(${(1 - progress) * 20}px)`,
      }}
    >
      {/* Arrow pointing up */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 32,
          fontWeight: 900,
          color: GROWTH_GREEN,
          lineHeight: 1,
          textShadow: `0 0 ${16 * pulse}px ${GROWTH_GREEN}80, 0 0 ${30 * pulse}px ${GROWTH_GREEN}40`,
        }}
      >
        &#x25B2;
      </div>
      {/* Delta value */}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 34,
          fontWeight: 900,
          color: GROWTH_GREEN,
          lineHeight: 1.1,
          textShadow: `0 0 ${14 * pulse}px ${GROWTH_GREEN}80`,
          letterSpacing: 1,
        }}
      >
        +{deltaPct}%
      </div>
    </div>
  );
};

/* ─── CANDLESTICK BAR ──────────────────────────── */
interface CandleBarProps {
  x: number; // center x of bar
  pct: number;
  label: string;
  year: string;
  dimmed: boolean;
  growProgress: number;
  countValue: number; // animated count
  glowPulse?: number; // 0-1 pulsing glow intensity for hero bar
}

const CandleBar: React.FC<CandleBarProps> = ({
  x,
  pct,
  label,
  year,
  dimmed,
  growProgress,
  countValue,
  glowPulse = 0,
}) => {
  const barW = 120;
  const wickW = 4;
  const fullH = (pct / MAX_Y) * INNER_H;
  const currentH = fullH * growProgress;
  const barTop = PADDING_TOP + INNER_H - currentH;
  const baseY = PADDING_TOP + INNER_H;

  const alpha = dimmed ? 0.4 : 1;
  const baseGlow = dimmed ? 0 : 24;
  const pulseGlow = baseGlow + glowPulse * 30;

  return (
    <>
      {/* Wick (thin vertical line, candlestick style) */}
      <div
        style={{
          position: "absolute",
          left: x - wickW / 2,
          top: barTop,
          width: wickW,
          height: currentH,
          background: dimmed
            ? "rgba(0,255,136,0.15)"
            : `linear-gradient(to top, ${GROWTH_GREEN}00, ${GROWTH_GREEN})`,
          opacity: alpha,
        }}
      />

      {/* Body (the wide candlestick body at top portion) */}
      <div
        style={{
          position: "absolute",
          left: x - barW / 2,
          top: barTop,
          width: barW,
          height: Math.max(currentH * 0.65, 0),
          borderRadius: "6px 6px 0 0",
          background: dimmed
            ? `linear-gradient(to top, rgba(0,255,136,0.08), rgba(0,255,136,0.2))`
            : `linear-gradient(to top, ${GROWTH_GREEN}15, ${GROWTH_GREEN}90)`,
          border: dimmed
            ? "1px solid rgba(0,255,136,0.12)"
            : `2px solid ${GROWTH_GREEN}60`,
          borderBottom: "none",
          boxShadow: !dimmed
            ? `0 0 ${pulseGlow}px ${GROWTH_GREEN}40, 0 0 ${pulseGlow * 2}px ${GROWTH_GREEN}20, inset 0 0 25px ${GROWTH_GREEN}10`
            : "none",
        }}
      />

      {/* Lower body fill (area below body to baseline) */}
      <div
        style={{
          position: "absolute",
          left: x - barW / 2,
          top: barTop + Math.max(currentH * 0.65, 0),
          width: barW,
          height: Math.max(currentH * 0.35, 0),
          background: dimmed
            ? "rgba(0,255,136,0.04)"
            : `linear-gradient(to bottom, ${GROWTH_GREEN}15, ${GROWTH_GREEN}05)`,
        }}
      />

      {/* Percentage label above bar */}
      {growProgress > 0.1 && (
        <div
          style={{
            position: "absolute",
            left: x - 80,
            top: barTop - 60,
            width: 160,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: 44,
            fontWeight: 800,
            color: dimmed ? "rgba(0,255,136,0.4)" : GROWTH_GREEN,
            textShadow: dimmed
              ? "none"
              : `0 0 16px ${GROWTH_GREEN}80, 0 0 30px ${GROWTH_GREEN}40`,
            opacity: Math.min(growProgress * 3, 1),
          }}
        >
          {countValue}%
        </div>
      )}

      {/* Ratio label */}
      {growProgress > 0.3 && (
        <div
          style={{
            position: "absolute",
            left: x - 80,
            top: barTop - 22,
            width: 160,
            textAlign: "center",
            fontFamily: FONT,
            fontSize: 22,
            fontWeight: 600,
            color: dimmed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)",
            letterSpacing: 1.5,
            opacity: Math.min((growProgress - 0.3) * 4, 1),
          }}
        >
          {label}
        </div>
      )}

      {/* Year label below baseline */}
      <div
        style={{
          position: "absolute",
          left: x - 50,
          top: baseY + 14,
          width: 100,
          textAlign: "center",
          fontFamily: FONT,
          fontSize: 24,
          fontWeight: 700,
          color: dimmed ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)",
          letterSpacing: 3,
          opacity: Math.min(growProgress * 2, 1),
        }}
      >
        {year}
      </div>
    </>
  );
};

/* ─── PEAK PULSE LINE ──────────────────────────── */
const PeakPulseLine: React.FC<{
  pct: number;
  growProgress: number;
  frame: number;
  fps: number;
}> = ({ pct, growProgress, frame, fps }) => {
  if (growProgress < 0.95) return null;

  const pulseAlpha =
    0.25 + 0.25 * Math.sin((frame / fps) * Math.PI * 4);
  const y = PADDING_TOP + yPos(pct);

  return (
    <>
      {/* Dashed line across full width */}
      <div
        style={{
          position: "absolute",
          left: PADDING_LEFT,
          top: y,
          width: INNER_W,
          height: 2,
          background: `repeating-linear-gradient(
            to right,
            ${GROWTH_GREEN}${Math.round(pulseAlpha * 255)
            .toString(16)
            .padStart(2, "0")} 0px,
            ${GROWTH_GREEN}${Math.round(pulseAlpha * 255)
            .toString(16)
            .padStart(2, "0")} 6px,
            transparent 6px,
            transparent 12px
          )`,
        }}
      />
      {/* Glow dot at right end */}
      <div
        style={{
          position: "absolute",
          left: PADDING_LEFT + INNER_W - 5,
          top: y - 5,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: GROWTH_GREEN,
          opacity: pulseAlpha + 0.3,
          boxShadow: `0 0 14px ${GROWTH_GREEN}`,
        }}
      />
      {/* Value tag at right */}
      <div
        style={{
          position: "absolute",
          left: PADDING_LEFT + INNER_W + 8,
          top: y - 12,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 700,
          color: GROWTH_GREEN,
          background: `${GROWTH_GREEN}18`,
          padding: "3px 10px",
          borderRadius: 4,
          border: `1px solid ${GROWTH_GREEN}40`,
          opacity: pulseAlpha + 0.4,
        }}
      >
        {pct}%
      </div>
    </>
  );
};

/* ─── X-AXIS BASELINE ──────────────────────────── */
const XAxisLine: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: PADDING_LEFT,
      top: PADDING_TOP + INNER_H,
      width: INNER_W,
      height: 2,
      background: "rgba(255,255,255,0.2)",
    }}
  />
);

/* ─── MAIN COMPONENT ───────────────────────────── */

interface Props {
  /** Which bar to show: "1in3" for shot 24, "1in4-compare" for shot 25 */
  variant: "1in3" | "1in4-compare";
}

export const AnimatedBarChart: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ── spring animations ───────────────────── */
  // Primary bar (2025) growth — dramatic SLAM with overshoot
  const bar2025Grow = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 180, mass: 1.4 },
    durationInFrames: 30,
  });

  // Secondary bar (2024) — appears slightly before or simultaneously
  const bar2024Grow =
    variant === "1in4-compare"
      ? spring({
          frame,
          fps,
          config: { damping: 14, stiffness: 140, mass: 1 },
          durationInFrames: 20,
        })
      : spring({
          frame: Math.max(0, frame - 3),
          fps,
          config: { damping: 14, stiffness: 140, mass: 1 },
          durationInFrames: 20,
        });

  /* ── pulsing glow on 2025 bar after it lands ── */
  const glowPulseStart = 28; // frame when glow pulse kicks in
  const glowPulseActive = frame >= glowPulseStart;
  const glowPulse = glowPulseActive
    ? 0.5 + 0.5 * Math.sin(((frame - glowPulseStart) / fps) * Math.PI * 3)
    : 0;

  /* ── impact tremble (noise-based organic shake) ── */
  // Trigger when main bar reaches peak (~frame 18-30)
  const trembleTriggerFrame = 14;
  const trembleDuration = 16; // frames
  const trembleProgress = interpolate(
    frame,
    [trembleTriggerFrame, trembleTriggerFrame + trembleDuration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const trembleActive = frame >= trembleTriggerFrame && trembleProgress > 0;
  const trembleAmplitude = 12; // max px displacement

  const shakeX = trembleActive
    ? noise2D("tremble-x", frame * 0.5, 0) * trembleAmplitude * trembleProgress
    : 0;
  const shakeY = trembleActive
    ? noise2D("tremble-y", 0, frame * 0.5) * trembleAmplitude * trembleProgress
    : 0;

  /* ── growth delta indicator animation ───── */
  const deltaAppearFrame = 22;
  const deltaProgress = interpolate(
    frame,
    [deltaAppearFrame, deltaAppearFrame + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  /* ── count-up values ─────────────────────── */
  const count2025 = Math.round(
    interpolate(bar2025Grow, [0, 1], [0, 33], {
      extrapolateRight: "clamp",
    })
  );
  const count2024 = Math.round(
    interpolate(bar2024Grow, [0, 1], [0, 25], {
      extrapolateRight: "clamp",
    })
  );

  /* ── warm manga-ish tinted border glow ───── */
  const borderGlow = `
    inset 0 0 60px rgba(255,100,40,0.03),
    0 0 80px rgba(0,255,136,0.04),
    inset 0 1px 0 rgba(255,255,255,0.06)
  `;

  /* ── bar positions ───────────────────────── */
  const barSpacing = variant === "1in3" ? INNER_W / 2 : INNER_W / 3;
  const bar2024X =
    variant === "1in3"
      ? PADDING_LEFT + barSpacing * 0.8
      : PADDING_LEFT + barSpacing;
  const bar2025X =
    variant === "1in3"
      ? PADDING_LEFT + barSpacing * 1.3
      : PADDING_LEFT + barSpacing * 2;

  /* ── fade-in the whole chart ─────────────── */
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      {/* Chart container — centered, TradingView panel */}
      <div
        style={{
          position: "relative",
          width: CHART_W,
          height: CHART_H,
          background: `linear-gradient(170deg, #111113, ${BG_BASE})`,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: borderGlow,
          overflow: "hidden",
          opacity: fadeIn,
          transform: `translate(${shakeX}px, ${shakeY}px)`,
        }}
      >
        {/* Warm manga-ish tint overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(255,120,50,0.03), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <ChartTitle />
        <LiveBadge frame={frame} fps={fps} />
        <GridLines />
        <YAxis />
        <XAxisLine />

        {/* ── BARS ──────────────────────────── */}
        {/* 2024 bar (always shown dimmed) */}
        <CandleBar
          x={bar2024X}
          pct={25}
          label="1 in 4"
          year="2024"
          dimmed
          growProgress={bar2024Grow}
          countValue={count2024}
        />

        {/* 2025 bar (hero bar) */}
        <CandleBar
          x={bar2025X}
          pct={33}
          label="1 in 3"
          year="2025"
          dimmed={false}
          growProgress={bar2025Grow}
          countValue={count2025}
          glowPulse={glowPulse}
        />

        {/* Growth delta indicator between bars */}
        <GrowthDelta
          x1={bar2024X}
          x2={bar2025X}
          pct2024={25}
          pct2025={33}
          progress={deltaProgress}
          frame={frame}
          fps={fps}
        />

        {/* Peak pulse line on 2025 value */}
        <PeakPulseLine
          pct={33}
          growProgress={bar2025Grow}
          frame={frame}
          fps={fps}
        />

        {/* Scanline overlay for terminal feel */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 3px,
              rgba(0,0,0,0.03) 3px,
              rgba(0,0,0,0.03) 4px
            )`,
            pointerEvents: "none",
          }}
        />

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(to right, transparent, ${GROWTH_GREEN}40, transparent)`,
          }}
        />
      </div>
    </div>
  );
};
