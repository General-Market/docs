import React from "react";
import {
  AbsoluteFill,
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

const PALETTE = {
  bgTop: "#1A1E25",
  bgBottom: "#06080C",
  gridLine: "rgba(255, 255, 255, 0.055)",
  gridDot: "rgba(255, 255, 255, 0.13)",
  text: "#F5F6F8",
  textDim: "#8E939D",
  textVeryDim: "#5F6571",
  gold: "#F1B638",
  goldBright: "#F4B73B",
  ghost: "rgba(255, 255, 255, 0.17)",
  grid: "rgba(255, 255, 255, 0.11)",
  axis: "#E4E7EB",
  tick: "rgba(255, 255, 255, 0.35)",
  dotRing: "#0A0D11",
};

const HOLD_SECONDS_PER_SNAPSHOT = 1.8;
const TRANSITION_FRACTION = 0.45;

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
  return holdFrames * dataset.snapshots.length + 18;
};

const DURATION = computeReelDuration(MARKETS_CONCENTRATION, FPS);

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(WIDTH / spacing);
  const rows = Math.ceil(HEIGHT / spacing);
  return (
    <AbsoluteFill>
      <svg
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="reel-grid-mask" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="reel-grid-fade">
            <rect width={WIDTH} height={HEIGHT} fill="url(#reel-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#reel-grid-fade)">
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line
              key={`h-${r}`}
              x1={0}
              y1={r * spacing}
              x2={WIDTH}
              y2={r * spacing}
              stroke={PALETTE.gridLine}
              strokeWidth={1.2}
            />
          ))}
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line
              key={`v-${c}`}
              x1={c * spacing}
              y1={0}
              x2={c * spacing}
              y2={HEIGHT}
              stroke={PALETTE.gridLine}
              strokeWidth={1.2}
            />
          ))}
          {Array.from({ length: rows + 1 }).flatMap((_, r) =>
            Array.from({ length: cols + 1 }).map((__, c) => (
              <circle
                key={`d-${r}-${c}`}
                cx={c * spacing}
                cy={r * spacing}
                r={2.5}
                fill={PALETTE.gridDot}
              />
            )),
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

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
        background: `radial-gradient(ellipse 100% 70% at 50% 25%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
        fontFamily: INTER,
      }}
    >
      <GridBackdrop />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, transparent 0%, transparent 50%, ${PALETTE.bgBottom} 100%)`,
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

        {/* Glow pass behind the gold curve. */}
        <polyline
          points={linePts}
          fill="none"
          stroke={PALETTE.goldBright}
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
          stroke={PALETTE.gold}
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
                fill={PALETTE.goldBright}
                opacity={0.4}
                filter="url(#reel-dot-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={15 * pulseScale}
                fill={PALETTE.gold}
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
              <img
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
