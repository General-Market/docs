import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { EASE } from "../../common/easing";
import { MARKETS_CONCENTRATION } from "./data";
import type { Dataset, Snapshot } from "./data";
import { LOGOS_BY_VENUE } from "./logos";

const TITLE_LINES = ["Share of profits", "captured by cohorts"];

// Stack a venue name onto two balanced lines so the right-column label reads big.
const wrapLabel = (label: string): string[] => {
  const words = label.split(" ");
  if (words.length <= 1) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
};

// Stripe ships Söhne (Klim) — not free / not on Google Fonts. Inter is the
// closest loadable neo-grotesque; tight tracking matches Stripe's headings.
const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const WIDTH = 2160;
const HEIGHT = 2160;
const FPS = 60;

// AntiCheat / Base palette. Light field, electric blue, near-black type —
// the dark dramatic dressing is gone; the data now reads like a keynote slide.
const PALETTE = {
  bgTop: "#FFFFFF",
  bgBottom: "#E7EAEE",
  text: "#0A0A0A",
  textDim: "#6E727A",
  textVeryDim: "#9AA0A8",
  accent: "#0052FF",
  accentSoft: "#5B79FF",
  ghost: "rgba(10, 10, 12, 0.07)",
  grid: "rgba(10, 10, 12, 0.10)",
  axis: "#1F1F24",
  tick: "rgba(10, 10, 12, 0.22)",
  dotRing: "#FFFFFF",
};

// Fast cadence: all twelve markets whip past in 4s — 20 frames each at 60fps.
// Short hold, a punchy whip into the next curve. The animation snaps.
const HOLD_SECONDS_PER_SNAPSHOT = 20 / 60;
const TRANSITION_FRACTION = 0.6;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpSnapshot = (a: Snapshot, b: Snapshot, t: number): number[] =>
  a.values.map((v, i) => lerp(v, b.values[i] ?? v, t));

const xAt = (i: number, n: number, plotL: number, plotW: number) =>
  plotL + (i / Math.max(1, n - 1)) * plotW;

const SYMLOG_LINTHRESH = 100;
const toScale = (v: number, scale: "linear" | "symlog"): number => {
  if (scale !== "symlog") return v;
  const a = Math.abs(v);
  if (a < SYMLOG_LINTHRESH) return v / SYMLOG_LINTHRESH;
  return Math.sign(v) * (1 + Math.log10(a / SYMLOG_LINTHRESH));
};

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

const computeReelDuration = (dataset: Dataset, fps: number): number => {
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  return holdFrames * dataset.snapshots.length;
};

const DURATION = computeReelDuration(MARKETS_CONCENTRATION, FPS);

// Background — the AntiCheat DotGrid, faithfully: a regular uniform grid of
// faint blue dots, with brighter bands of blue "light" travelling across it.
// The grid is static and memoised; only the light bands recompute each frame.
const GRID_SPACING = 30;
const GRID_DOT_R = 1.7;
const GRID_ALPHA = 0.16;

const RegularGrid: React.FC = React.memo(() => {
  const cols = Math.ceil(WIDTH / GRID_SPACING) + 1;
  const rows = Math.ceil(HEIGHT / GRID_SPACING) + 1;
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", inset: 0 }}
    >
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <circle
            key={`${r}-${c}`}
            cx={c * GRID_SPACING}
            cy={r * GRID_SPACING}
            r={GRID_DOT_R}
            fill={PALETTE.accent}
            opacity={GRID_ALPHA}
          />
        )),
      )}
    </svg>
  );
});
RegularGrid.displayName = "RegularGrid";

// Bands of light, lifted from anticheat/DotGrid. Each is one or more grid rows
// whose dots are brighter; the band drifts horizontally at a steady velocity
// and wraps. Spread across the full height so the light moves everywhere.
type LightBand = {
  y: number;
  len: number;
  anchor: number;
  rows: number;
  alpha: number;
  velocity: number;
  phase: number;
};
const LIGHT_BANDS: LightBand[] = [
  { y: 0.045, len: 0.62, anchor: 0.30, rows: 2, alpha: 0.95, velocity: 380, phase: 0.0 },
  { y: 0.08, len: 0.58, anchor: 0.46, rows: 1, alpha: 0.92, velocity: 540, phase: 0.3 },
  { y: 0.115, len: 0.42, anchor: 0.22, rows: 2, alpha: 0.95, velocity: 320, phase: 0.55 },
  { y: 0.21, len: 0.50, anchor: 0.70, rows: 1, alpha: 0.92, velocity: 620, phase: 0.1 },
  { y: 0.245, len: 0.30, anchor: 0.84, rows: 2, alpha: 0.95, velocity: 720, phase: 0.4 },
  { y: 0.42, len: 0.18, anchor: 0.10, rows: 1, alpha: 0.85, velocity: 820, phase: 0.65 },
  { y: 0.62, len: 0.36, anchor: 0.78, rows: 2, alpha: 0.92, velocity: 580, phase: 0.2 },
  { y: 0.655, len: 0.22, anchor: 0.88, rows: 1, alpha: 0.9, velocity: 700, phase: 0.5 },
  { y: 0.85, len: 0.58, anchor: 0.62, rows: 2, alpha: 0.95, velocity: 360, phase: 0.05 },
  { y: 0.885, len: 0.62, anchor: 0.42, rows: 1, alpha: 0.92, velocity: 500, phase: 0.35 },
  { y: 0.92, len: 0.46, anchor: 0.74, rows: 3, alpha: 0.95, velocity: 280, phase: 0.6 },
];

// The bands streak across fast — 8× the base drift.
const LIGHT_SPEED = 8;

const snapGrid = (px: number) => Math.round(px / GRID_SPACING) * GRID_SPACING;

const TravellingLight: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cycleW = WIDTH * 1.6;
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", inset: 0 }}
    >
      {LIGHT_BANDS.map((band, bi) => {
        const yC = snapGrid(band.y * HEIGHT);
        const lenPx = band.len * WIDTH;
        const half = lenPx / 2;
        const drift = band.velocity * LIGHT_SPEED * t;
        const mid =
          (((band.anchor * WIDTH + drift + band.phase * cycleW) % cycleW) +
            cycleW) %
            cycleW -
          cycleW * 0.3;
        const x0 = snapGrid(mid - half);
        const x1 = snapGrid(mid + half);
        if (x1 < -40 || x0 > WIDTH + 40) return null;

        const cols = Math.max(2, Math.round((x1 - x0) / GRID_SPACING) + 1);
        const fadePx = lenPx * 0.18;
        const rowAnchor = Math.floor((band.rows - 1) / 2);
        const rowOffsets = Array.from(
          { length: band.rows },
          (_, r) => (r - rowAnchor) * GRID_SPACING,
        );

        return (
          <g key={bi}>
            {rowOffsets.map((yOff, ri) => (
              <g key={ri}>
                {Array.from({ length: cols }).map((_, di) => {
                  const x = x0 + di * GRID_SPACING;
                  if (x < -20 || x > WIDTH + 20) return null;
                  const fromStart = x - x0;
                  const fromEnd = x1 - x;
                  let a = 1;
                  if (fromStart < fadePx) a *= fromStart / fadePx;
                  if (fromEnd < fadePx) a *= fromEnd / fadePx;
                  a = Math.max(0, Math.min(1, a));
                  return (
                    <circle
                      key={di}
                      cx={x}
                      cy={yC + yOff}
                      r={GRID_DOT_R * 1.25}
                      fill={PALETTE.accent}
                      opacity={band.alpha * 0.7 * a}
                    />
                  );
                })}
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

// Gentle vignette — the grid fills the frame and only the far corners fall off.
const DOT_FIELD_MASK =
  "radial-gradient(ellipse 92% 92% at 50% 44%, #000 0%, #000 68%, transparent 100%)";

const MovingDotField: React.FC = () => (
  <AbsoluteFill
    style={{
      WebkitMaskImage: DOT_FIELD_MASK,
      maskImage: DOT_FIELD_MASK,
    }}
  >
    <RegularGrid />
    <TravellingLight />
  </AbsoluteFill>
);

export const RetailPnLMarketsReel: React.FC = () => {
  const dataset = MARKETS_CONCENTRATION;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = WIDTH;
  const H = HEIGHT;

  // Layout — the plot claims nearly the full width (this ships on Twitter, so it
  // takes all the room it can). Title sits top-left, venue label top-right; the
  // logo strip and source live in the band below the plot.
  const MARGIN = 120; // outer gutter from the frame edges
  const AXIS_GUTTER = 140; // room for the large y-axis labels left of the plot
  const plotL = MARGIN + AXIS_GUTTER; // 260
  const plotR = W - MARGIN; // 2040
  const plotW = plotR - plotL; // 1780 — full width
  const plotT = 380;
  const plotH = 1600 - plotT; // plot bottom at y=1600 — fills the vertical band

  const scale = dataset.yScale ?? "linear";

  // Scrub state — hold each snapshot, crossfade into the next.
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  const transitionFrames = Math.round(holdFrames * TRANSITION_FRACTION);
  const sliceLen = dataset.snapshots.length;
  const totalScrubFrames = holdFrames * sliceLen;

  // Open at the lip of the first transition so the curve is already moving on
  // frame 1 — no static beat to start on. The first market is shown for a
  // single frame, then immediately whips toward the next.
  const startOffset = holdFrames - transitionFrames;
  const within = Math.min(frame + startOffset, totalScrubFrames - 1);
  const idxRaw = within / holdFrames;
  const idxFloor = Math.min(Math.floor(idxRaw), sliceLen - 1);
  const idxNext = Math.min(idxFloor + 1, sliceLen - 1);
  const localFrame = within - idxFloor * holdFrames;
  const transitionStart = startOffset;
  const tRaw = (localFrame - transitionStart) / Math.max(1, transitionFrames);
  const tEased = interpolate(
    Math.max(0, Math.min(1, tRaw)),
    [0, 1],
    [0, 1],
    { easing: EASE.out },
  );

  const current = dataset.snapshots[idxFloor];
  const next = dataset.snapshots[idxNext] ?? current;
  const interpolated = lerpSnapshot(current, next, tEased);
  const labelDuringTransition = tEased > 0.5 ? next : current;

  // Dots breathe on each new snapshot.
  const snapAge = localFrame;
  const pulse = spring({
    frame: snapAge,
    fps,
    config: { damping: 12, stiffness: 220, mass: 0.7 },
    from: 0,
    to: 1,
  });
  const pulseScale = 1 + 0.05 * (1 - pulse);

  // No fade-in: frame 0 lands on the first snapshot fully drawn. The scrub,
  // the dot pulse, and the per-venue swap carry the motion.

  const yTickElems = dataset.yTicks.map((tick) => {
    const y = yAt(tick, dataset.yMin, dataset.yMax, plotT, plotH, scale);
    return (
      <g key={`yt-${tick}`}>
        <line
          x1={plotL}
          x2={plotL + plotW}
          y1={y}
          y2={y}
          stroke={PALETTE.grid}
          strokeWidth={2}
        />
        <line
          x1={plotL - 22}
          x2={plotL}
          y1={y}
          y2={y}
          stroke={PALETTE.tick}
          strokeWidth={3}
        />
        <text
          x={plotL - 40}
          y={y + 18}
          textAnchor="end"
          fontFamily={INTER}
          fontSize={52}
          fontWeight={600}
          letterSpacing="-0.01em"
          fill={PALETTE.axis}
        >
          {dataset.yFormat(tick)}
        </text>
      </g>
    );
  });

  const xLabelElems = dataset.xLabels.map((label, i) => {
    const x = xAt(i, dataset.xLabels.length, plotL, plotW);
    return (
      <g key={`xl-${i}`}>
        <line
          x1={x}
          x2={x}
          y1={plotT + plotH}
          y2={plotT + plotH + 20}
          stroke={PALETTE.tick}
          strokeWidth={3}
        />
        <text
          x={x}
          y={plotT + plotH + 78}
          textAnchor="middle"
          fontFamily={INTER}
          fontSize={46}
          fontWeight={600}
          letterSpacing="-0.01em"
          fill={PALETTE.axis}
        >
          {label}
        </text>
      </g>
    );
  });

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
      stroke={PALETTE.ghost}
      strokeWidth={3}
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

  const source = labelDuringTransition.source ?? dataset.source;
  const venue = labelDuringTransition.label;
  const venueLines = wrapLabel(venue);
  const venueLogos = LOGOS_BY_VENUE[venue] ?? [];

  // Right-column dips to near-black at the midpoint of the crossfade, so the
  // venue label + logos swap rather than morph.
  const swapDip = interpolate(
    Math.abs(tEased - 0.5) * 2,
    [0, 1],
    [0.12, 1],
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 80% at 50% 16%, ${PALETTE.bgTop} 0%, #F0F2F4 55%, ${PALETTE.bgBottom} 100%)`,
        fontFamily: INTER,
      }}
    >
      <MovingDotField />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 45%, transparent 0%, transparent 58%, rgba(10, 12, 20, 0.05) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Title — top-left at the outer margin, balanced two lines. */}
      <div
        style={{
          position: "absolute",
          top: MARGIN,
          left: MARGIN,
          fontFamily: INTER,
          fontSize: 96,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineHeight: 1.0,
          color: PALETTE.text,
        }}
      >
        {TITLE_LINES.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          position: "absolute",
          inset: 0,
        }}
      >
        <defs>
          <filter
            id="reel-line-glow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter
            id="reel-dot-glow"
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {yTickElems}
        {ghostLines}

        {/* Glow pass behind the accent curve. */}
        <polyline
          points={linePts}
          fill="none"
          stroke={PALETTE.accentSoft}
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
          filter="url(#reel-line-glow)"
        />

        {/* Highlighted current line. */}
        <polyline
          points={linePts}
          fill="none"
          stroke={PALETTE.accent}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {interpolated.map((v, i) => {
          const cx = xAt(i, interpolated.length, plotL, plotW);
          const cy = yAt(v, dataset.yMin, dataset.yMax, plotT, plotH, scale);
          return (
            <g key={`dot-${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={20 * pulseScale}
                fill={PALETTE.accentSoft}
                opacity={0.4}
                filter="url(#reel-dot-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={15 * pulseScale}
                fill={PALETTE.accent}
                stroke={PALETTE.dotRing}
                strokeWidth={5}
              />
            </g>
          );
        })}

        {xLabelElems}

      </svg>

      {/* Venue label — top-right, mirrors the title across the full width. */}
      <div
        style={{
          position: "absolute",
          top: MARGIN,
          right: MARGIN,
          maxWidth: 820,
          textAlign: "right",
          fontFamily: INTER,
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 0.96,
          color: PALETTE.text,
          opacity: swapDip,
        }}
      >
        {venueLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Logo strip — the six dominant platforms, centered under the plot. */}
      {venueLogos.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: plotT + plotH + 96,
            left: plotL,
            width: plotW,
            display: "flex",
            justifyContent: "center",
            gap: 30,
            opacity: swapDip,
          }}
        >
          {venueLogos.slice(0, 6).map((logo) => (
            <div
              key={logo.file}
              style={{
                width: 270,
                height: 270,
                flexShrink: 0,
                borderRadius: 52,
                background: "rgba(255, 255, 255, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                boxShadow: "0 24px 60px -34px rgba(0, 0, 0, 0.9)",
              }}
            >
              <Img
                src={staticFile(logo.file)}
                alt={logo.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* Source — bottom-left, wraps inside the frame. */}
      {source ? (
        <div
          style={{
            position: "absolute",
            top: plotT + plotH + 392,
            left: MARGIN,
            width: plotR - MARGIN,
            fontFamily: INTER,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: 1.4,
            color: PALETTE.textVeryDim,
          }}
        >
          Source: {source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const retailPnLMarketsReelMeta = {
  id: "RetailPnLMarketsReel",
  component: RetailPnLMarketsReel,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
};
