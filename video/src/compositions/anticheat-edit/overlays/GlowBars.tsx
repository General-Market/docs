import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";

// Dark grid + glowing rounded pills, modeled on the reference frame Max
// shared. The chart fills the screen, the camera feed sleeps under it,
// and the bars rise on a single beat. The frame argument is the
// section-local frame — 0 = first frame the chart is on screen — so
// the entrance reads the same wherever in the timeline this chart fires.

export type GlowBar = {
  key: string;
  /** Bar value. Heights are normalized to max(value) inside the chart. */
  value: number;
  /** % or formatted value rendered above the pill. */
  topLabel: string;
  /** Brand or category name rendered below the pill. */
  bottomLabel: string;
  /** Pill core color. Halo is derived from this. */
  color: string;
};

export type GlowBarsProps = {
  title: string;
  subtitle?: string;
  bars: GlowBar[];
  /** Optional caption rendered in the lower-left corner — sourced from. */
  footer?: string;
  /** Bottom-right corner stamp — usually the section number. */
  stamp?: string;
};

const BG = "#050507";
const GRID = "rgba(255, 255, 255, 0.06)";
const GRID_STRONG = "rgba(255, 255, 255, 0.10)";
const INK_DIM = "rgba(255, 255, 255, 0.55)";
const INK_FAINT = "rgba(255, 255, 255, 0.30)";

const W = 1920;
const H = 1080;

// Grid cell size. Matches the spacing in the reference frame.
const CELL = 72;

export const GlowBars: React.FC<GlowBarsProps> = ({
  title,
  subtitle,
  bars,
  footer,
  stamp,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);

  // Chart geometry. Bars sit in a 1680-wide band centered horizontally,
  // baseline at y = 880, max bar height = 620. The title sits at y = 96,
  // subtitle below it.
  const PLOT_W = 1680;
  const PLOT_LEFT = (W - PLOT_W) / 2;
  const BASELINE = 880;
  const MAX_BAR_H = 620;
  const GAP_MIN = 16;

  // Per-bar width is computed so the band stays a fixed width regardless
  // of bar count. Narrow when many, wide when few.
  const barCount = bars.length;
  const totalGap = GAP_MIN * (barCount - 1);
  const barW = Math.min(150, (PLOT_W - totalGap) / Math.max(barCount, 1));
  const effectiveBandW = barW * barCount + totalGap;
  const bandLeft = PLOT_LEFT + (PLOT_W - effectiveBandW) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: BG, fontFamily: font, overflow: "hidden" }}>
      <GridBackground />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: font,
          fontSize: 80,
          fontWeight: 800,
          letterSpacing: "-0.022em",
          lineHeight: 1.0,
          color: INK_FAINT,
          textTransform: "uppercase",
          padding: "0 96px",
        }}
      >
        <TitleReveal title={title} frame={frame} fps={fps} />
      </div>
      {subtitle ? (
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: font,
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.016em",
            color: INK_DIM,
            padding: "0 96px",
          }}
        >
          <SubtitleReveal subtitle={subtitle} frame={frame} fps={fps} />
        </div>
      ) : null}

      {/* Bars */}
      {bars.map((bar, i) => {
        const x = bandLeft + i * (barW + GAP_MIN);
        const targetH = (Math.abs(bar.value) / max) * MAX_BAR_H;

        // Each bar pops in with a 6-frame stagger, springs to full height.
        const localFrame = frame - 14 - i * 3;
        const rise = spring({
          fps,
          frame: Math.max(0, localFrame),
          config: { mass: 0.6, damping: 14, stiffness: 110 },
          durationInFrames: 28,
        });
        const h = targetH * rise;
        const visible = localFrame >= 0;

        // Continuous glow pulse — every 36 frames the halo flares.
        const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * 2.6);
        const haloA = 0.35 + 0.45 * pulse;
        const haloR1 = 22 + 14 * pulse;
        const haloR2 = 60 + 40 * pulse;
        const haloR3 = 120 + 80 * pulse;

        // Top label fades in with the bar, slightly after.
        const labelOpacity = interpolate(
          localFrame - 6,
          [0, 8],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div key={bar.key} style={{ position: "absolute", inset: 0 }}>
            {/* Bar pill */}
            {visible ? (
              <div
                style={{
                  position: "absolute",
                  left: x,
                  top: BASELINE - h,
                  width: barW,
                  height: h,
                  borderRadius: barW,
                  background: bar.color,
                  boxShadow: `
                    0 0 ${haloR1}px ${withAlpha(bar.color, haloA)},
                    0 0 ${haloR2}px ${withAlpha(bar.color, haloA * 0.7)},
                    0 0 ${haloR3}px ${withAlpha(bar.color, haloA * 0.35)}
                  `,
                }}
              />
            ) : null}

            {/* Top % label */}
            <div
              style={{
                position: "absolute",
                left: x - 50,
                top: BASELINE - h - 78,
                width: barW + 100,
                textAlign: "center",
                fontFamily: monoFont,
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: "-0.011em",
                color: bar.color,
                textShadow: `0 0 24px ${withAlpha(bar.color, 0.9)}, 0 0 8px ${withAlpha(bar.color, 1)}`,
                opacity: labelOpacity,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {bar.topLabel}
            </div>

            {/* Brand chip + name below */}
            <div
              style={{
                position: "absolute",
                left: x - 60,
                top: BASELINE + 24,
                width: barW + 120,
                textAlign: "center",
                opacity: labelOpacity,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  padding: barCount > 10 ? "6px 10px" : "8px 14px",
                  borderRadius: 12,
                  background: bar.color,
                  fontFamily: font,
                  fontSize: barCount > 10 ? 14 : 18,
                  fontWeight: 700,
                  letterSpacing: "-0.005em",
                  color: contrastOn(bar.color),
                  whiteSpace: "nowrap",
                  maxWidth: barW + 80,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {bar.bottomLabel}
              </div>
            </div>
          </div>
        );
      })}

      {/* Baseline */}
      <div
        style={{
          position: "absolute",
          left: PLOT_LEFT,
          top: BASELINE,
          width: PLOT_W,
          height: 0,
          borderTop: `1px solid ${GRID_STRONG}`,
        }}
      />

      {/* Footer */}
      {footer ? (
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 32,
            fontFamily: monoFont,
            fontSize: 18,
            color: INK_FAINT,
            letterSpacing: "+0.011em",
            textTransform: "uppercase",
          }}
        >
          {footer}
        </div>
      ) : null}
      {stamp ? (
        <div
          style={{
            position: "absolute",
            right: 48,
            bottom: 32,
            fontFamily: monoFont,
            fontSize: 18,
            color: INK_FAINT,
            letterSpacing: "+0.011em",
            textTransform: "uppercase",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {stamp}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const TitleReveal: React.FC<{ title: string; frame: number; fps: number }> = ({
  title,
  frame,
  fps,
}) => {
  const op = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [0, 16], [-24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <span style={{ display: "inline-block", opacity: op, transform: `translateY(${y}px)` }}>
      {title}
    </span>
  );
};

const SubtitleReveal: React.FC<{ subtitle: string; frame: number; fps: number }> = ({
  subtitle,
  frame,
  fps,
}) => {
  const op = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <span style={{ display: "inline-block", opacity: op }}>{subtitle}</span>;
};

const GridBackground: React.FC = () => {
  // SVG grid spanning the whole frame, with a soft top-down vignette
  // that lifts the title and a left-right vignette that frames the bars.
  return (
    <AbsoluteFill aria-hidden>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={BG} stopOpacity="0.0" />
            <stop offset="0.55" stopColor={BG} stopOpacity="0.0" />
            <stop offset="1" stopColor={BG} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {/* Vertical lines */}
        {Array.from({ length: Math.ceil(W / CELL) + 1 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * CELL}
            y1={0}
            x2={i * CELL}
            y2={H}
            stroke={GRID}
            strokeWidth={1}
          />
        ))}
        {/* Horizontal lines */}
        {Array.from({ length: Math.ceil(H / CELL) + 1 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={i * CELL}
            x2={W}
            y2={i * CELL}
            stroke={GRID}
            strokeWidth={1}
          />
        ))}
        <rect x={0} y={0} width={W} height={H} fill="url(#gv)" />
      </svg>
    </AbsoluteFill>
  );
};

// ─── Color helpers ────────────────────────────────────────────────────────

function withAlpha(hexOrRgb: string, alpha: number): string {
  // Accept #rrggbb, #rgb, or rgb(r,g,b).
  if (hexOrRgb.startsWith("rgb(")) {
    const inside = hexOrRgb.slice(4, -1);
    return `rgba(${inside}, ${alpha})`;
  }
  const hex = hexOrRgb.replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function contrastOn(bg: string): string {
  // Quick YIQ check; light bgs get dark text, dark bgs get white.
  const hex = bg.startsWith("#") ? bg.slice(1) : bg;
  const full = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0A0A0A" : "#FFFFFF";
}
