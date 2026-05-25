import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../common/fonts";
import { EASE } from "../../common/easing";
import type { Dataset, Snapshot } from "./data";


const COLORS = {
  ink: "#0A0A0B",            // hero text
  inkSoft: "#6E6E73",         // axis labels (Apple secondary)
  inkSofter: "#A1A1A6",       // hints
  ghost: "rgba(0,0,0,0.085)", // year fan
  ghostStrong: "rgba(0,0,0,0.16)",
  grid: "rgba(0,0,0,0.06)",
  zeroLine: "rgba(0,0,0,0.32)",
  highlight: "#F1B638",       // Saez/Zucman gold
  highlightDot: "#E8AB1F",
  redZone: "rgba(220, 38, 38, 0.06)",
  bg: "#FFFFFF",
};

const HOLD_SECONDS_PER_SNAPSHOT = 1.8;
const TRANSITION_FRACTION = 0.45;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpSnapshot = (a: Snapshot, b: Snapshot, t: number): number[] =>
  a.values.map((v, i) => lerp(v, b.values[i] ?? v, t));

// Map x bucket index → svg x within plot rect.
const xAt = (i: number, n: number, plotL: number, plotW: number) =>
  plotL + (i / Math.max(1, n - 1)) * plotW;

// Symmetric-log transform. Linear within ±SYMLOG_LINTHRESH, log decade outside.
const SYMLOG_LINTHRESH = 100;
const toScale = (v: number, scale: "linear" | "symlog"): number => {
  if (scale !== "symlog") return v;
  const a = Math.abs(v);
  if (a < SYMLOG_LINTHRESH) return v / SYMLOG_LINTHRESH;
  return Math.sign(v) * (1 + Math.log10(a / SYMLOG_LINTHRESH));
};

// Y axis: standard orientation. 0% at the bottom, 100% at the top.
const yAt = (
  v: number,
  yMin: number,
  yMax: number,
  plotT: number,
  plotH: number,
  scale: "linear" | "symlog",
) => {
  const sv = toScale(v, scale);
  const smin = toScale(yMin, scale);
  const smax = toScale(yMax, scale);
  return plotT + (1 - (sv - smin) / (smax - smin)) * plotH;
};

const polyPoints = (
  values: number[],
  yMin: number,
  yMax: number,
  plotL: number,
  plotT: number,
  plotW: number,
  plotH: number,
  scale: "linear" | "symlog",
): string =>
  values
    .map((v, i) => {
      const x = xAt(i, values.length, plotL, plotW);
      const y = yAt(v, yMin, yMax, plotT, plotH, scale);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

export type ChartEngineProps = {
  dataset: Dataset;
  width?: number;
  height?: number;
  // Caption pinned to top, e.g. "VARIANT A · REAL DATA"
  caption?: string;
};

export const ChartEngine: React.FC<ChartEngineProps> = ({
  dataset,
  width: widthProp,
  height: heightProp,
  caption,
}) => {
  const frame = useCurrentFrame();
  const { fps, width: cfgW, height: cfgH } = useVideoConfig();
  const W = widthProp ?? cfgW;
  const H = heightProp ?? cfgH;

  // ── Layout — square Saez/Zucman style ─────────────────────────────────────
  const cardX = 0;
  const cardY = 0;
  const cardW = W;
  const cardH = H;

  const padLeft = 110;       // y-axis labels (room for "100%")
  const padRight = 320;      // room for the longest label ("Sports betting")
  const padTop = 80;         // small title strip
  const padBottom = 120;     // x-axis labels + source
  const plotL = cardX + padLeft;
  const plotT = cardY + padTop;
  const plotW = cardW - padLeft - padRight;
  const plotH = cardH - padTop - padBottom;

  // ── Scrub state ───────────────────────────────────────────────────────────
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  const transitionFrames = Math.round(holdFrames * TRANSITION_FRACTION);
  const sliceLen = dataset.snapshots.length;
  const totalScrubFrames = holdFrames * sliceLen;

  const within = Math.min(frame, totalScrubFrames - 1);
  const idxRaw = within / holdFrames;
  const idxFloor = Math.min(Math.floor(idxRaw), sliceLen - 1);
  const idxNext = Math.min(idxFloor + 1, sliceLen - 1);
  const localFrame = within - idxFloor * holdFrames;
  const transitionStart = holdFrames - transitionFrames;
  const tRaw = (localFrame - transitionStart) / Math.max(1, transitionFrames);
  const tEased = interpolate(
    Math.max(0, Math.min(1, tRaw)),
    [0, 1],
    [0, 1],
    { easing: EASE.smooth },
  );

  const current = dataset.snapshots[idxFloor];
  const next = dataset.snapshots[idxNext] ?? current;
  const interpolated = lerpSnapshot(current, next, tEased);
  const labelDuringTransition = tEased > 0.5 ? next : current;

  // Snapshot pulse — tiny attack on each new frame so the eye registers it.
  const snapAge = localFrame; // frames since current snapshot started
  const pulse = spring({
    frame: snapAge,
    fps,
    config: { damping: 12, stiffness: 220, mass: 0.7 },
    from: 0,
    to: 1,
  });
  const pulseScale = 1 + 0.05 * (1 - pulse); // dots breathe by 5%

  // No fade-in — frame 0 lands on the first snapshot fully visible.
  const introOpacity = 1;

  const scale = dataset.yScale ?? "linear";

  // ── Below-zero red wash — only meaningful if 0 is in range ────────────────
  const yZero = dataset.yMin < 0 && dataset.yMax > 0
    ? yAt(0, dataset.yMin, dataset.yMax, plotT, plotH, scale)
    : null;

  // ── Y-axis ticks ──────────────────────────────────────────────────────────
  const yTickElems = dataset.yTicks.map((tick) => {
    const y = yAt(tick, dataset.yMin, dataset.yMax, plotT, plotH, scale);
    const isZero = tick === 0;
    return (
      <g key={`yt-${tick}`}>
        <line
          x1={plotL}
          x2={plotL + plotW}
          y1={y}
          y2={y}
          stroke={isZero ? COLORS.zeroLine : COLORS.grid}
          strokeWidth={isZero ? 1.6 : 1}
        />
        <text
          x={plotL - 28}
          y={y + 9}
          textAnchor="end"
          fontFamily={font}
          fontSize={26}
          fontWeight={isZero ? 700 : 500}
          fill={isZero ? COLORS.ink : COLORS.inkSoft}
        >
          {dataset.yFormat(tick)}
        </text>
      </g>
    );
  });

  // ── X-axis labels ─────────────────────────────────────────────────────────
  const xLabelElems = dataset.xLabels.map((label, i) => {
    const x = xAt(i, dataset.xLabels.length, plotL, plotW);
    return (
      <text
        key={`xl-${i}`}
        x={x}
        y={plotT + plotH + 44}
        textAnchor="middle"
        fontFamily={font}
        fontSize={24}
        fontWeight={500}
        fill={COLORS.inkSoft}
      >
        {label}
      </text>
    );
  });

  // ── Ghost lines — fan of all snapshots, Saez/Zucman thin gray ────────────
  const ghostLines = dataset.snapshots.map((snap, i) => (
    <polyline
      key={`ghost-${i}`}
      points={polyPoints(
        snap.values,
        dataset.yMin,
        dataset.yMax,
        plotL,
        plotT,
        plotW,
        plotH,
        scale,
      )}
      fill="none"
      stroke={COLORS.ghost}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));

  const linePts = polyPoints(
    interpolated,
    dataset.yMin,
    dataset.yMax,
    plotL,
    plotT,
    plotW,
    plotH,
    scale,
  );



  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: font }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0, opacity: introOpacity }}
      >
        {/* Below-zero red wash */}
        {yZero !== null ? (
          <rect
            x={plotL}
            y={yZero}
            width={plotW}
            height={plotT + plotH - yZero}
            fill={COLORS.redZone}
          />
        ) : null}

        {/* Title — top-left, all-caps Saez/Zucman style */}
        <text
          x={cardX + padLeft - 40}
          y={cardY + 50}
          fontFamily={font}
          fontSize={26}
          fontWeight={700}
          letterSpacing="0.04em"
          fill={COLORS.ink}
        >
          {dataset.title.toUpperCase()}
        </text>

        {/* Plot area */}
        {yTickElems}
        {ghostLines}

        {/* Highlighted current line */}
        <polyline
          points={linePts}
          fill="none"
          stroke={COLORS.highlight}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {interpolated.map((v, i) => {
          const cx = xAt(i, interpolated.length, plotL, plotW);
          const cy = yAt(v, dataset.yMin, dataset.yMax, plotT, plotH, scale);
          return (
            <circle
              key={`dot-${i}`}
              cx={cx}
              cy={cy}
              r={12 * pulseScale}
              fill={COLORS.highlight}
              stroke={COLORS.bg}
              strokeWidth={4}
            />
          );
        })}

        {/* X labels */}
        {xLabelElems}

        {/* Source — bottom of card, switches per snapshot */}
        {labelDuringTransition.source ?? dataset.source ? (
          <text
            x={cardX + padLeft - 40}
            y={cardY + cardH - 28}
            fontFamily={font}
            fontSize={14}
            fontWeight={500}
            fill={COLORS.inkSofter}
          >
            Source: {labelDuringTransition.source ?? dataset.source}
          </text>
        ) : null}

        {/* Market label — at the right endpoint of the highlighted line.
            Saez/Zucman "2007" style: small, bold, sits beside the line tip. */}
        <text
          x={plotL + plotW + 16}
          y={(() => {
            const lastIdx = interpolated.length - 1;
            return yAt(interpolated[lastIdx], dataset.yMin, dataset.yMax, plotT, plotH, scale) + 10;
          })()}
          fontFamily={font}
          fontSize={32}
          fontWeight={800}
          letterSpacing="-0.01em"
          fill={COLORS.ink}
        >
          {labelDuringTransition.label}
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export const computeChartDuration = (
  dataset: Dataset,
  fps: number,
): number => {
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  return holdFrames * dataset.snapshots.length + 18;
};
