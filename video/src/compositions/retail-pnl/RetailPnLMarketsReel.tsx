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

// The fixed metric, shown as a centered subtitle under the changing venue.
const SUBTITLE = "Share of profits captured by cohorts";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

// Normal landscape video format — a 16:9 CRT screen.
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;

// Light field palette. White ground, near-black keynote type, saturated data.
const BG_GRADIENT =
  "radial-gradient(ellipse 120% 95% at 50% 18%, #FFFFFF 0%, #FBFCFE 62%, #F2F5F8 100%)";
const PALETTE = {
  text: "#1D2026", // venue title
  textDim: "#6E727A", // subtitle
  textVeryDim: "#9AA0A8", // source
  ghost: "rgba(10, 12, 20, 0.10)", // previous-chart lines
  grid: "rgba(10, 12, 20, 0.07)", // axis gridlines, faint
  axis: "#3A3F49", // axis labels
  tick: "rgba(10, 12, 20, 0.22)",
  dotRing: "#FFFFFF",
};

// Per-market colour — the reference hues, deepened so each reads on the light
// field: blue, green, amber, violet, teal, orange, lime, magenta, emerald,
// sky, indigo, red. (The reference's white becomes indigo — white is invisible
// on a white field.)
const NEON = [
  "#1F6FEB",
  "#16B33F",
  "#D9931C",
  "#7B3FE4",
  "#109A8E",
  "#F0601C",
  "#8DA017",
  "#E0318C",
  "#18AE66",
  "#1B95E0",
  "#3D4CC9",
  "#E63838",
];
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};
const NEON_RGB = NEON.map(hexToRgb);

// Fast cadence: all twelve markets whip past in 4s — 20 frames each at 60fps.
const HOLD_SECONDS_PER_SNAPSHOT = 20 / 60;
const TRANSITION_FRACTION = 0.6;

// Tail: hold the final market, then the CRT cuts out.
const TAIL_HOLD = 18;
const SHUTDOWN_FRAMES = 28;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string =>
  `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(
    lerp(a[1], b[1], t),
  )}, ${Math.round(lerp(a[2], b[2], t))})`;

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
  return holdFrames * dataset.snapshots.length + TAIL_HOLD + SHUTDOWN_FRAMES;
};

const DURATION = computeReelDuration(MARKETS_CONCENTRATION, FPS);

// ── Background — curved monitor grid ───────────────────────────────────────
// A flat square grid bowed by the barrel displacement filter together with the
// rest of the screen, so the whole image curves like a CRT — text included.
const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;

const GRID_SPACING = 150;
const GRID_LINE_COLOR = "rgba(30, 44, 84, 0.07)";

// Flat straight grid. The whole screen — grid, chart, axis, title, logos — is
// bowed together by the barrel displacement filter, so nothing is pre-curved.
const H_YS = Array.from(
  { length: Math.ceil(HEIGHT / GRID_SPACING) + 1 },
  (_, i) => i * GRID_SPACING,
);
const V_XS = Array.from(
  { length: Math.ceil(WIDTH / GRID_SPACING) + 1 },
  (_, i) => i * GRID_SPACING,
);

const FlatGrid: React.FC = React.memo(() => (
  <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
    {H_YS.map((y, i) => (
      <line
        key={`h-${i}`}
        x1={-40}
        y1={y}
        x2={WIDTH + 40}
        y2={y}
        stroke={GRID_LINE_COLOR}
        strokeWidth={1.5}
      />
    ))}
    {V_XS.map((x, i) => (
      <line
        key={`v-${i}`}
        x1={x}
        y1={-40}
        x2={x}
        y2={HEIGHT + 40}
        stroke={GRID_LINE_COLOR}
        strokeWidth={1.5}
      />
    ))}
  </svg>
));
FlatGrid.displayName = "FlatGrid";

// ── Barrel displacement map ────────────────────────────────────────────────
// A precomputed radial map fed to feDisplacementMap. It bows the WHOLE screen
// outward like a CRT — text included. Each RGB channel is displaced at a
// slightly different scale, so the colour separates only toward the edges
// (zero at the centre): the retro glitch rides the rim, never the main content.
const DISP_NX = 96;
const DISP_NY = 54;
const buildBarrelMap = (): string => {
  const cw = WIDTH / DISP_NX;
  const ch = HEIGHT / DISP_NY;
  let rects = "";
  for (let j = 0; j < DISP_NY; j++) {
    for (let i = 0; i < DISP_NX; i++) {
      const nx = ((i + 0.5) * cw - HALF_W) / HALF_W;
      const ny = ((j + 0.5) * ch - HALF_H) / HALF_H;
      const r2 = nx * nx + ny * ny;
      // Push outward, growing with r² → the image bulges convex like a tube.
      // R encodes x-displacement, G encodes y (0.5 = none).
      const dx = Math.max(-1, Math.min(1, (nx * r2) / 2));
      const dy = Math.max(-1, Math.min(1, (ny * r2) / 2));
      const R = Math.round((dx * 0.5 + 0.5) * 255);
      const G = Math.round((dy * 0.5 + 0.5) * 255);
      rects += `<rect x='${(i * cw).toFixed(1)}' y='${(j * ch).toFixed(1)}' width='${(cw + 1).toFixed(1)}' height='${(ch + 1).toFixed(1)}' fill='rgb(${R},${G},128)'/>`;
    }
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${WIDTH}' height='${HEIGHT}'>${rects}</svg>`,
  )}`;
};
const BARREL_MAP = buildBarrelMap();
const BARREL_SCALE = 180; // base bow strength (px of edge displacement)

const SCREEN_MASK =
  "radial-gradient(ellipse 99% 99% at 50% 50%, #000 0%, #000 78%, transparent 100%)";

const CurvedScreen: React.FC = () => (
  <AbsoluteFill
    style={{
      WebkitMaskImage: SCREEN_MASK,
      maskImage: SCREEN_MASK,
    }}
  >
    <FlatGrid />
  </AbsoluteFill>
);

// ── CRT / VCR overlays — deterministic feTurbulence seeded by the frame ─────

const SNOW_OPACITY = 0.16;

const SnowStatic: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: SNOW_OPACITY,
        mixBlendMode: "overlay",
      }}
    >
      <filter id="crt-snow">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={2}
          seed={frame % 256}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#crt-snow)" />
    </svg>
  );
};

const VCR_BAND_H = 110;
const VCRBand: React.FC = () => {
  const frame = useCurrentFrame();
  const y = ((frame * 7) % (HEIGHT + VCR_BAND_H)) - VCR_BAND_H;
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "overlay",
      }}
    >
      <filter id="crt-vcr">
        <feTurbulence
          type="turbulence"
          baseFrequency="0.012 0.6"
          numOctaves={2}
          seed={frame % 256}
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="2.2" intercept="-0.78" />
        </feComponentTransfer>
      </filter>
      <rect
        x={0}
        y={y}
        width="100%"
        height={VCR_BAND_H}
        filter="url(#crt-vcr)"
        opacity={0.45}
      />
    </svg>
  );
};

const Scanlines: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      mixBlendMode: "multiply",
      backgroundImage:
        "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.11) 50%), linear-gradient(90deg, rgba(255,0,0,0.04), rgba(0,255,0,0.012), rgba(0,0,255,0.04))",
      backgroundSize: "100% 3px, 4px 100%",
    }}
  />
);

// Lighter tube vignette than before.
const CRTVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      borderRadius: 26,
      background:
        "radial-gradient(ellipse 88% 90% at 50% 50%, transparent 70%, rgba(0,0,0,0.08) 90%, rgba(0,0,0,0.22) 100%)",
      boxShadow: "inset 0 0 90px 16px rgba(0,0,0,0.16)",
    }}
  />
);

export const RetailPnLMarketsReel: React.FC = () => {
  const dataset = MARKETS_CONCENTRATION;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = WIDTH;
  const H = HEIGHT;

  // Layout for the 16:9 frame — centered header, a tall plot that fills the
  // height, a big logo strip and the source below.
  const MARGIN = 80;
  const MARGIN_TOP = 46;
  const AXIS_GUTTER = 90;
  const plotL = MARGIN + AXIS_GUTTER; // 170
  const plotR = W - MARGIN; // 1840
  const plotW = plotR - plotL; // 1670
  const plotT = 205;
  const PLOT_BOTTOM = 745;
  const plotH = PLOT_BOTTOM - plotT; // 540

  const scale = dataset.yScale ?? "linear";

  // Scrub state — hold each snapshot, whip into the next.
  const holdFrames = Math.max(20, Math.round(HOLD_SECONDS_PER_SNAPSHOT * fps));
  const transitionFrames = Math.round(holdFrames * TRANSITION_FRACTION);
  const sliceLen = dataset.snapshots.length;
  const totalScrubFrames = holdFrames * sliceLen;
  const shutdownStart = totalScrubFrames + TAIL_HOLD;

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

  // Per-market neon colour, blended across the transition.
  const curveColor = lerpColor(NEON_RGB[idxFloor], NEON_RGB[idxNext], tEased);

  // Dots breathe on each new snapshot; the glow flashes as a market lands.
  const pulse = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 220, mass: 0.7 },
    from: 0,
    to: 1,
  });
  const pulseScale = 1 + 0.05 * (1 - pulse);
  const flash = Math.max(0, 1 - localFrame / 6);

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
          y={plotT + plotH + 44}
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
      strokeWidth={3.5}
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
  const venueLogos = LOGOS_BY_VENUE[venue] ?? [];

  const swapDip = interpolate(Math.abs(tEased - 0.5) * 2, [0, 1], [0.12, 1]);

  // Retro RGB glitch — confined to the screen-border frame. It flicks WITH the
  // graph: the channel offset jumps on each market landing (flash), then
  // settles. Never touches the text. No screen wobble.
  const borderOff = 0.6 + 4 * flash;

  // CRT power-off — collapse to a bright horizontal line, hold, then snap to a
  // point at the centre and wink out.
  const sd =
    frame >= shutdownStart
      ? Math.min(1, (frame - shutdownStart) / SHUTDOWN_FRAMES)
      : 0;
  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const sdScaleY = interpolate(sd, [0, 0.42, 1], [1, 0.006, 0.006], clamp);
  const sdScaleX = interpolate(sd, [0, 0.66, 1], [1, 1, 0.002], clamp);
  const sdBright = interpolate(
    sd,
    [0, 0.1, 0.42, 0.7, 1],
    [1, 1.9, 3.2, 2, 1],
    clamp,
  );
  const sdOpacity = interpolate(sd, [0.86, 1], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill
        style={{
          background: BG_GRADIENT,
          fontFamily: INTER,
          transform: `scale(${(1.02 * sdScaleX).toFixed(4)}, ${(1.02 * sdScaleY).toFixed(4)})`,
          transformOrigin: "50% 50%",
          filter: `brightness(${sdBright.toFixed(2)})`,
          opacity: sdOpacity,
        }}
      >
        {/* Glow filters for the neon curve + dots. */}
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <filter
              id="reel-line-glow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="11" />
            </filter>
            <filter
              id="reel-dot-glow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur stdDeviation="6" />
            </filter>
            <filter
              id="reel-barrel"
              x="-12%"
              y="-12%"
              width="124%"
              height="124%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={BARREL_MAP}
                x="0"
                y="0"
                width={WIDTH}
                height={HEIGHT}
                preserveAspectRatio="none"
                result="map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="map"
                scale={BARREL_SCALE}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>

        {/* Everything on the tube — grid, chart, type, logos — bowed together
            by the barrel displacement filter, so the whole image curves. */}
        <AbsoluteFill style={{ filter: "url(#reel-barrel)" }}>
        <CurvedScreen />

        {/* Header — centered. Venue is the big title; metric is the subtitle. */}
        <div
          style={{
            position: "absolute",
            top: MARGIN_TOP,
            left: 0,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
              color: PALETTE.text,
              whiteSpace: "nowrap",
              opacity: swapDip,
            }}
          >
            {venue}
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: INTER,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: PALETTE.textDim,
            }}
          >
            {SUBTITLE}
          </div>
        </div>

        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: "absolute", inset: 0 }}
        >
          {yTickElems}
          {ghostLines}

          {/* Wide neon glow — bursts as a market lands so the colour pops. */}
          <polyline
            points={linePts}
            fill="none"
            stroke={curveColor}
            strokeWidth={14 + 24 * flash}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.45 + 0.55 * flash}
            filter="url(#reel-line-glow)"
          />

          {/* Bright core line. */}
          <polyline
            points={linePts}
            fill="none"
            stroke={curveColor}
            strokeWidth={7}
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
                  r={(12 + 11 * flash) * pulseScale}
                  fill={curveColor}
                  opacity={0.45 + 0.45 * flash}
                  filter="url(#reel-dot-glow)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={8 * pulseScale}
                  fill={curveColor}
                  stroke={PALETTE.dotRing}
                  strokeWidth={2.5}
                />
              </g>
            );
          })}

          {xLabelElems}
        </svg>

        {/* Logo strip — big, centered under the plot. */}
        {venueLogos.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: PLOT_BOTTOM + 58,
              left: plotL,
              width: plotW,
              display: "flex",
              justifyContent: "center",
              gap: 24,
              opacity: swapDip,
            }}
          >
            {venueLogos.slice(0, 6).map((logo) => (
              <div
                key={logo.file}
                style={{
                  width: 184,
                  height: 184,
                  flexShrink: 0,
                  borderRadius: 38,
                  background: "rgba(255, 255, 255, 0.96)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 22,
                  boxShadow:
                    "0 18px 44px -22px rgba(0, 0, 0, 0.9), 0 0 40px -10px rgba(255,255,255,0.12)",
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

        {/* Source — bottom-left. */}
        {source ? (
          <div
            style={{
              position: "absolute",
              top: PLOT_BOTTOM + 58 + 184 + 12,
              left: MARGIN,
              width: plotR - MARGIN,
              fontFamily: INTER,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              lineHeight: 1.3,
              color: PALETTE.textVeryDim,
            }}
          >
            Source: {source}
          </div>
        ) : null}
        </AbsoluteFill>

        {/* Soft screen glare. */}
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            mixBlendMode: "screen",
            background:
              "linear-gradient(122deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 22%, transparent 40%)",
          }}
        />

        {/* CRT / VCR stack. */}
        <SnowStatic />
        <VCRBand />
        <Scanlines />
        <CRTVignette />

        {/* RGB-split glitch — only on the screen-border frame; never the text. */}
        <svg
          width={W}
          height={H}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        >
          {(
            [
              ["#FF2A2A", borderOff, borderOff],
              ["#13DE45", 0, 0],
              ["#2A6BFF", -borderOff, -borderOff],
            ] as const
          ).map(([stroke, ox, oy]) => (
            <rect
              key={stroke}
              x={4}
              y={4}
              width={W - 8}
              height={H - 8}
              rx={16}
              fill="none"
              stroke={stroke}
              strokeWidth={4}
              transform={`translate(${ox}, ${oy})`}
            />
          ))}
        </svg>
      </AbsoluteFill>
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
