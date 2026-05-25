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

// Normal landscape video format — a 16:9 frame, so the curved-monitor glass
// reads like a real screen rather than a square card.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;

// AntiCheat / Base palette. Light field, electric blue curve, near-black type.
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

// ── Background — curved monitor screen ─────────────────────────────────────
// No dot grid. Full-width dashed lines bowed by a barrel warp, like the rows
// of a curved CRT. Each line carries its own muted colour and scrolls its
// dashes at its own speed; every dash on a line shares that speed. The chart
// and type stay flat and crisp in front.

// CRT "monitor curvature" — barrel warp on the screen lines only. Zero at the
// centre, growing with r², so the rows bow outward at the rim.
const BARREL_K = 0.13;
const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;
const barrel = (x: number, y: number): { x: number; y: number } => {
  const nx = (x - HALF_W) / HALF_W;
  const ny = (y - HALF_H) / HALF_H;
  const f = 1 + BARREL_K * (nx * nx + ny * ny);
  return { x: HALF_W + nx * f * HALF_W, y: HALF_H + ny * f * HALF_H };
};

// The dashes scroll fast — 8× the base velocity.
const LIGHT_SPEED = 8;
const DASH = 15;
const GAP = 21;
const DASH_PERIOD = DASH + GAP;
const LINE_MARGIN = 180; // sample beyond the frame so bowed ends still cover

// A bowed full-width row at height yRow, sampled and warped into a polyline.
// Static per row, so it is precomputed once below.
const bowedRow = (yRow: number): string => {
  const N = 56;
  const span = WIDTH + 2 * LINE_MARGIN;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -LINE_MARGIN + (i / N) * span;
    const p = barrel(x, yRow);
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  return pts.join(" ");
};

// Muted, harmonised palette — desaturated indigo/teal/violet/sage/clay.
// Editorial, never neon.
const LINE_HUES = [
  "#6E8BE0", "#52A9A0", "#9079C9", "#5FA0C2", "#86AE84", "#AC7E9C",
  "#6E8FBE", "#BFA268", "#8893DE", "#4F97B2", "#BC876C", "#7C88B0",
];
const SCREEN_LINE_COUNT = 16;
const SCREEN_LINES = Array.from({ length: SCREEN_LINE_COUNT }, (_, i) => {
  const y = ((i + 0.5) / SCREEN_LINE_COUNT) * HEIGHT;
  return {
    points: bowedRow(y),
    color: LINE_HUES[i % LINE_HUES.length],
    velocity: 70 + ((i * 53) % 180), // each line a different scroll speed
    phase: (i * 0.37) % 1,
  };
});

const ScreenLines: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{ position: "absolute", inset: 0 }}
    >
      {SCREEN_LINES.map((ln, i) => (
        <polyline
          key={i}
          points={ln.points}
          fill="none"
          stroke={ln.color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeDasharray={`${DASH} ${GAP}`}
          strokeDashoffset={
            -((ln.velocity * LIGHT_SPEED * t + ln.phase * DASH_PERIOD) %
              DASH_PERIOD)
          }
          opacity={0.62}
        />
      ))}
    </svg>
  );
};

// Gentle vignette — the screen fills the frame and only the far corners fall off.
const SCREEN_MASK =
  "radial-gradient(ellipse 98% 98% at 50% 46%, #000 0%, #000 72%, transparent 100%)";

const CurvedScreen: React.FC = () => (
  <AbsoluteFill
    style={{
      WebkitMaskImage: SCREEN_MASK,
      maskImage: SCREEN_MASK,
      // Chromatic-aberration fringe — the glass-package lens character.
      filter: "url(#reel-chroma)",
    }}
  >
    <ScreenLines />
  </AbsoluteFill>
);

export const RetailPnLMarketsReel: React.FC = () => {
  const dataset = MARKETS_CONCENTRATION;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = WIDTH;
  const H = HEIGHT;

  // Layout for the 16:9 frame — title top-left, venue label top-right, the
  // plot filling the width, logo strip and source in the band below it.
  const MARGIN = 80;
  const MARGIN_TOP = 56;
  const AXIS_GUTTER = 90;
  const plotL = MARGIN + AXIS_GUTTER; // 170
  const plotR = W - MARGIN; // 1840
  const plotW = plotR - plotL; // 1670
  const plotT = 250;
  const PLOT_BOTTOM = 700;
  const plotH = PLOT_BOTTOM - plotT; // 450

  const scale = dataset.yScale ?? "linear";

  // Scrub state — hold each snapshot, whip into the next.
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  const transitionFrames = Math.round(holdFrames * TRANSITION_FRACTION);
  const sliceLen = dataset.snapshots.length;
  const totalScrubFrames = holdFrames * sliceLen;

  // Open at the lip of the first transition so the curve is already moving on
  // frame 1 — no static beat to start on.
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
          strokeWidth={1.5}
        />
        <line
          x1={plotL - 14}
          x2={plotL}
          y1={y}
          y2={y}
          stroke={PALETTE.tick}
          strokeWidth={2}
        />
        <text
          x={plotL - 26}
          y={y + 11}
          textAnchor="end"
          fontFamily={INTER}
          fontSize={30}
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
          y2={plotT + plotH + 13}
          stroke={PALETTE.tick}
          strokeWidth={2}
        />
        <text
          x={x}
          y={plotT + plotH + 46}
          textAnchor="middle"
          fontFamily={INTER}
          fontSize={27}
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

  const source = labelDuringTransition.source ?? dataset.source;
  const venue = labelDuringTransition.label;
  const venueLines = wrapLabel(venue);
  const venueLogos = LOGOS_BY_VENUE[venue] ?? [];

  // Right column dips at the crossfade midpoint so the venue label + logos
  // swap rather than morph.
  const swapDip = interpolate(
    Math.abs(tEased - 0.5) * 2,
    [0, 1],
    [0.12, 1],
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 120% 90% at 50% 16%, ${PALETTE.bgTop} 0%, #F0F2F4 55%, ${PALETTE.bgBottom} 100%)`,
        fontFamily: INTER,
      }}
    >
      {/* Filter defs — chromatic split for the glass lens, glows for the curve. */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter
            id="reel-chroma"
            x="-3%"
            y="-3%"
            width="106%"
            height="106%"
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="r"
            />
            <feOffset in="r" dx="1.8" dy="0" result="rS" />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="g"
            />
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="b"
            />
            <feOffset in="b" dx="-1.8" dy="0" result="bS" />
            <feBlend in="rS" in2="g" mode="screen" result="rg" />
            <feBlend in="rg" in2="bS" mode="screen" />
          </filter>
        </defs>
      </svg>

      <CurvedScreen />

      {/* Title — top-left, balanced two lines. */}
      <div
        style={{
          position: "absolute",
          top: MARGIN_TOP,
          left: MARGIN,
          fontFamily: INTER,
          fontSize: 72,
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
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter
            id="reel-dot-glow"
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {yTickElems}
        {ghostLines}

        {/* Glow pass behind the accent curve. */}
        <polyline
          points={linePts}
          fill="none"
          stroke={PALETTE.accentSoft}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
          filter="url(#reel-line-glow)"
        />

        {/* Highlighted current line. */}
        <polyline
          points={linePts}
          fill="none"
          stroke={PALETTE.accent}
          strokeWidth={6}
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
                r={12 * pulseScale}
                fill={PALETTE.accentSoft}
                opacity={0.4}
                filter="url(#reel-dot-glow)"
              />
              <circle
                cx={cx}
                cy={cy}
                r={8.5 * pulseScale}
                fill={PALETTE.accent}
                stroke={PALETTE.dotRing}
                strokeWidth={3}
              />
            </g>
          );
        })}

        {xLabelElems}
      </svg>

      {/* Venue label — top-right, mirrors the title. */}
      <div
        style={{
          position: "absolute",
          top: MARGIN_TOP,
          right: MARGIN,
          maxWidth: 660,
          textAlign: "right",
          fontFamily: INTER,
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 0.98,
          color: PALETTE.text,
          opacity: swapDip,
        }}
      >
        {venueLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Logo strip — the dominant platforms, centered under the plot. */}
      {venueLogos.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: PLOT_BOTTOM + 72,
            left: plotL,
            width: plotW,
            display: "flex",
            justifyContent: "center",
            gap: 22,
            opacity: swapDip,
          }}
        >
          {venueLogos.slice(0, 6).map((logo) => (
            <div
              key={logo.file}
              style={{
                width: 150,
                height: 150,
                flexShrink: 0,
                borderRadius: 32,
                background: "rgba(255, 255, 255, 0.95)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 18,
                boxShadow: "0 16px 40px -24px rgba(0, 0, 0, 0.9)",
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
            top: PLOT_BOTTOM + 72 + 150 + 22,
            left: MARGIN,
            width: plotR - MARGIN,
            fontFamily: INTER,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            lineHeight: 1.35,
            color: PALETTE.textVeryDim,
          }}
        >
          Source: {source}
        </div>
      ) : null}

      {/* Glass package — soft screen glare, then an edge vignette over all. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          mixBlendMode: "screen",
          background:
            "linear-gradient(122deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 22%, transparent 40%)",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 82% 84% at 50% 46%, transparent 0%, transparent 52%, rgba(10, 14, 30, 0.13) 100%)",
        }}
      />
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
