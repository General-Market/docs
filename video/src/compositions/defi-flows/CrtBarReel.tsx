// Winners-only bar chart in a light, glass-on-tube style: a faintly ruled screen
// bowed by a barrel filter, bold centered title, neon columns rising above
// backlit logo cards, soft snow + scanlines + VCR band. The harsh vertical RGB
// bands and the CRT power-off were removed (they read as ugly on Twitter); the
// winning column carries an accelerating field of upward chevrons.

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
import { fmtUSD, fmtValue, type FlowDataset, type FlowMode, type FlowRow, metricOf, niceStep } from "./FlowReel";

const { fontFamily: INTER } = loadInter("normal", { weights: ["400", "500", "600", "700", "800"] });

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 60;
const DURATION = 320;

const BG_GRADIENT = "radial-gradient(ellipse 120% 95% at 50% 18%, #FFFFFF 0%, #FBFCFE 62%, #F2F5F8 100%)";
const PALETTE = {
  text: "#1D2026",
  textDim: "#6E727A",
  textVeryDim: "#9AA0A8",
  grid: "rgba(10, 12, 20, 0.07)",
  axis: "#3A3F49",
  tick: "rgba(10, 12, 20, 0.22)",
};

// Deepened hues that read on a white field — same set as the reference reel.
const NEON = ["#1F6FEB", "#16B33F", "#D9931C", "#7B3FE4", "#109A8E", "#F0601C", "#8DA017", "#E0318C"];

const HALF_W = WIDTH / 2;
const HALF_H = HEIGHT / 2;
const GRID_SPACING_X = 218;
const GRID_SPACING_Y = 133;
const GRID_LINE_COLOR = "rgba(30, 44, 84, 0.07)";
const H_YS = Array.from({ length: Math.ceil(HEIGHT / GRID_SPACING_Y) + 1 }, (_, i) => i * GRID_SPACING_Y);
const V_XS = Array.from({ length: Math.ceil(WIDTH / GRID_SPACING_X) + 1 }, (_, i) => i * GRID_SPACING_X);

const FlatGrid: React.FC = React.memo(() => (
  <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0 }}>
    {H_YS.map((y, i) => (
      <line key={`h-${i}`} x1={-40} y1={y} x2={WIDTH + 40} y2={y} stroke={GRID_LINE_COLOR} strokeWidth={1.5} />
    ))}
    {V_XS.map((x, i) => (
      <line key={`v-${i}`} x1={x} y1={-40} x2={x} y2={HEIGHT + 40} stroke={GRID_LINE_COLOR} strokeWidth={1.5} />
    ))}
  </svg>
));
FlatGrid.displayName = "FlatGrid";

// Barrel displacement map — bows the whole screen outward like a CRT tube.
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
      const dx = Math.max(-1, Math.min(1, (nx * r2) / 2));
      const dy = Math.max(-1, Math.min(1, (ny * r2) / 2));
      const R = Math.round((dx * 0.5 + 0.5) * 255);
      const G = Math.round((dy * 0.5 + 0.5) * 255);
      rects += `<rect x='${(i * cw).toFixed(1)}' y='${(j * ch).toFixed(1)}' width='${(cw + 1).toFixed(1)}' height='${(ch + 1).toFixed(1)}' fill='rgb(${R},${G},128)'/>`;
    }
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${WIDTH}' height='${HEIGHT}'>${rects}</svg>`)}`;
};
const BARREL_MAP = buildBarrelMap();
const BARREL_SCALE = 180;
const SCREEN_MASK = "radial-gradient(ellipse 99% 99% at 50% 50%, #000 0%, #000 78%, transparent 100%)";

const SnowStatic: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay" }}>
      <filter id="crtb-snow">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={frame % 256} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#crtb-snow)" />
    </svg>
  );
};

const VCR_BAND_H = 64;
const VCRBand: React.FC = () => {
  const frame = useCurrentFrame();
  const y = ((frame * 7) % (HEIGHT + VCR_BAND_H)) - VCR_BAND_H;
  return (
    <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, pointerEvents: "none", mixBlendMode: "overlay" }}>
      <filter id="crtb-vcr">
        <feTurbulence type="turbulence" baseFrequency="0.012 0.6" numOctaves={2} seed={frame % 256} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="2.2" intercept="-0.82" />
        </feComponentTransfer>
      </filter>
      <rect x={0} y={y} width="100%" height={VCR_BAND_H} filter="url(#crtb-vcr)" opacity={0.12} />
    </svg>
  );
};

// No scanlines — fine horizontal lines alias into ugly banding under Twitter
// compression. The tube identity now rides on the barrel + soft vignette alone.

const CRTVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      borderRadius: 26,
      background: "radial-gradient(ellipse 90% 92% at 50% 50%, transparent 74%, rgba(0,0,0,0.05) 90%, rgba(0,0,0,0.15) 100%)",
      boxShadow: "inset 0 0 80px 14px rgba(0,0,0,0.1)",
    }}
  />
);

// ── Layout ──────────────────────────────────────────────────────────────────
const MARGIN = 80;
const AXIS_GUTTER = 96;
const PLOT_L = MARGIN + AXIS_GUTTER; // 176
const PLOT_R = WIDTH - MARGIN; // 1840
const PLOT_W = PLOT_R - PLOT_L;
const COL_TOP = 326; // tallest column top
const BASE_Y = 706; // column baseline
const MAX_H = BASE_Y - COL_TOP; // 380

// Fewer winners → fatter columns and bigger logos, filling the width.
const layoutFor = (n: number) => {
  const slot = PLOT_W / n;
  const colCap = n <= 3 ? 248 : n <= 4 ? 220 : n <= 6 ? 190 : 168;
  const logoCap = n <= 3 ? 212 : n <= 4 ? 188 : n <= 6 ? 166 : 142;
  return {
    slot,
    colW: Math.min(slot * 0.5, colCap),
    logoSize: Math.min(slot * 0.7, logoCap),
  };
};

const fmtAxis = (t: number, mode: FlowMode): string => {
  if (Math.abs(t) < 1e-9) return mode === "pct" ? "0%" : "$0";
  return mode === "pct" ? `${+t.toFixed(0)}%` : fmtUSD(t);
};

// Accelerating field of upward chevrons inside the winning column. The scroll
// speed ramps with t², so the column reads as taking off.
const ChevronField: React.FC<{ x: number; top: number; colW: number; h: number; local: number; fps: number }> = ({
  x,
  top,
  colW,
  h,
  local,
  fps,
}) => {
  if (h < 14) return null;
  const tile = Math.min(92, Math.max(52, colW * 0.44));
  const arm = tile * 0.46;
  const thick = tile * 0.3;
  const inset = colW * 0.17;
  const cx = x + colW / 2;
  const lx = x + inset;
  const rx = x + colW - inset;

  const t = Math.max(0, (local - 6) / fps);
  const dist = 90 * t + 0.5 * 300 * t * t; // v0=90 px/s, a=300 px/s²
  const shift = ((dist % tile) + tile) % tile;
  const build = Math.min(1, t * 1.4);

  const rows: React.ReactNode[] = [];
  const count = Math.ceil(h / tile) + 3;
  for (let k = -1; k < count; k++) {
    const yTip = top + h - k * tile - shift;
    const yArm = yTip + arm;
    const frac = (yTip - top) / h; // 0 at top, 1 at baseline
    const op = interpolate(frac, [0, 0.13, 1], [0, 0.4, 0.18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * build;
    if (op <= 0.01) continue;
    rows.push(
      <path
        key={k}
        d={`M ${lx} ${yArm} L ${cx} ${yTip} L ${rx} ${yArm} L ${rx} ${yArm + thick} L ${cx} ${yTip + thick} L ${lx} ${yArm + thick} Z`}
        fill="#FFFFFF"
        opacity={op}
      />,
    );
  }
  return <>{rows}</>;
};

const Column: React.FC<{
  row: FlowRow;
  index: number;
  isTop: boolean;
  centerX: number;
  colW: number;
  logoSize: number;
  scaleTop: number;
  mode: FlowMode;
  color: string;
  logoBase: string;
}> = ({ row, index, isTop, centerX, colW, logoSize, scaleTop, mode, color, logoBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = 24 + index * 8;
  const local = frame - start;

  const rise = spring({ frame: local, fps, config: { damping: 15, stiffness: 95, mass: 1 }, durationInFrames: 42 });
  const grow = Math.max(0, rise);
  const flash = Math.max(0, 1 - local / 7);

  const v = metricOf(row, mode);
  const h = (v / scaleTop) * MAX_H * grow;
  const top = BASE_Y - h;
  const x = centerX - colW / 2;
  const rx = Math.min(14, colW * 0.12);
  const valOpacity = interpolate(grow, [0.3, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const clipId = `crtb-clip-${row.id.replace(/[^a-z0-9]/gi, "-")}`;

  // One-time card entrance — no continuous bob.
  const cardIn = spring({ frame: local, fps, config: { damping: 18, stiffness: 120, mass: 0.6 }, durationInFrames: 26 });

  return (
    <>
      {/* neon glow behind the column */}
      <rect x={x} y={top} width={colW} height={h} rx={rx} fill={color} opacity={0.4 + 0.4 * flash} filter="url(#crtb-bar-glow)" />
      {/* the column */}
      <rect x={x} y={top} width={colW} height={h} rx={rx} fill={color} />
      <rect x={x} y={top} width={colW} height={h} rx={rx} fill="url(#crtb-bar-sheen)" />

      {/* accelerating chevrons — winner only */}
      {isTop ? (
        <>
          <clipPath id={clipId}>
            <rect x={x} y={top} width={colW} height={h} rx={rx} />
          </clipPath>
          <g clipPath={`url(#${clipId})`}>
            <ChevronField x={x} top={top} colW={colW} h={h} local={local} fps={fps} />
          </g>
        </>
      ) : null}

      {/* value on top */}
      <text
        x={centerX}
        y={top - 28}
        textAnchor="middle"
        fontFamily={INTER}
        fontSize={isTop ? 64 : 46}
        fontWeight={800}
        letterSpacing="-0.02em"
        fill={color}
        opacity={valOpacity}
        style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
      >
        {fmtValue(v * grow, mode)}
      </text>
      {/* logo card with a clean colour bloom backlight, centered at the baseline */}
      <foreignObject x={centerX - logoSize / 2} y={BASE_Y + 20} width={logoSize} height={logoSize + 106}>
        <div style={{ width: logoSize, opacity: cardIn }}>
          <div style={{ position: "relative", width: logoSize, height: logoSize, transform: `scale(${(0.92 + 0.08 * cardIn).toFixed(3)})`, transformOrigin: "50% 50%" }}>
            {/* backlight: a radial bloom in the column's colour, not the blurred logo */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "48%",
                width: "170%",
                height: "170%",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                filter: "blur(16px)",
                opacity: 0.55 + 0.3 * flash,
                background: `radial-gradient(circle, ${color}cc 0%, ${color}55 34%, ${color}00 70%)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: logoSize * 0.22,
                background: "rgba(255,255,255,0.97)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: logoSize * 0.13,
                boxShadow: "0 18px 44px -22px rgba(0,0,0,0.85)",
              }}
            >
              <Img src={staticFile(`${logoBase}/${row.id}.jpg`)} alt={row.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              textAlign: "center",
              fontFamily: INTER,
              fontSize: Math.max(22, Math.min(32, Math.round(logoSize * 0.16))),
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: PALETTE.text,
              lineHeight: 1.05,
            }}
          >
            {row.name}
          </div>
        </div>
      </foreignObject>
    </>
  );
};

export const CrtBarReel: React.FC<{ dataset: FlowDataset }> = ({ dataset }) => {
  const frame = useCurrentFrame();
  const mode: FlowMode = dataset.mode ?? "usd";

  const winners = dataset.rows.filter((r) => metricOf(r, mode) > 0).sort((a, b) => metricOf(b, mode) - metricOf(a, mode));
  const n = winners.length;
  const maxV = metricOf(winners[0], mode);
  const step = niceStep(maxV);
  const scaleTop = Math.ceil((maxV * 1.05) / step) * step;

  const { slot, colW, logoSize } = layoutFor(n);
  const centerX = (i: number) => PLOT_L + slot * (i + 0.5);
  const yFor = (val: number) => BASE_Y - (val / scaleTop) * MAX_H;
  const ticks: number[] = [];
  for (let t = 0; t <= scaleTop + 1e-9; t += step) ticks.push(t);

  const windowLabel = dataset.eyebrow.includes("24") ? "last 24 hours" : "last 7 days";
  const subtitle = `${mode === "pct" ? "Biggest TVL growth" : "Biggest net inflow"} · ${windowLabel}`;

  const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const headerEnter = interpolate(frame, [0, 22], [0, 1], { ...clamp, easing: EASE.out });
  const landFlash = Math.max(0, 1 - (frame - (24 + (n - 1) * 8)) / 8);

  // Soft bloom hold on the ending — no power-off collapse.
  const endStart = DURATION - 40;
  const bloom = Math.sin(interpolate(frame, [endStart, DURATION - 1], [0, 1], clamp) * Math.PI);
  const winnerX = centerX(0);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill
        style={{
          background: BG_GRADIENT,
          fontFamily: INTER,
          transform: "scale(1.02)",
          transformOrigin: "50% 50%",
        }}
      >
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <filter id="crtb-bar-glow" x="-60%" y="-30%" width="220%" height="160%">
              <feGaussianBlur stdDeviation="13" />
            </filter>
            <linearGradient id="crtb-bar-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
              <stop offset="42%" stopColor="rgba(255,255,255,0.05)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
            </linearGradient>
            <filter id="crtb-barrel" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
              <feImage href={BARREL_MAP} x="0" y="0" width={WIDTH} height={HEIGHT} preserveAspectRatio="none" result="map" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={BARREL_SCALE} xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>

        <AbsoluteFill style={{ filter: "url(#crtb-barrel)" }}>
          <AbsoluteFill style={{ WebkitMaskImage: SCREEN_MASK, maskImage: SCREEN_MASK }}>
            <FlatGrid />
          </AbsoluteFill>

          {/* Header */}
          <div style={{ position: "absolute", top: 40, left: 0, width: "100%", textAlign: "center", opacity: headerEnter }}>
            <div style={{ fontFamily: INTER, fontSize: 100, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.0, color: PALETTE.text, whiteSpace: "nowrap" }}>
              {dataset.title}
            </div>
            <div style={{ marginTop: 6, fontFamily: INTER, fontSize: 42, fontWeight: 700, letterSpacing: "-0.01em", color: PALETTE.textDim }}>
              {subtitle}
            </div>
          </div>

          <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
            {/* y gridlines + axis labels */}
            {ticks.map((t) => {
              const y = yFor(t);
              return (
                <g key={`t-${t}`}>
                  <line x1={PLOT_L} x2={PLOT_R} y1={y} y2={y} stroke={PALETTE.grid} strokeWidth={1.5} />
                  <line x1={PLOT_L - 14} x2={PLOT_L} y1={y} y2={y} stroke={PALETTE.tick} strokeWidth={2} />
                  <text x={PLOT_L - 26} y={y + 11} textAnchor="end" fontFamily={INTER} fontSize={30} fontWeight={600} fill={PALETTE.axis} style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}>
                    {fmtAxis(t, mode)}
                  </text>
                </g>
              );
            })}
            {/* baseline */}
            <line x1={PLOT_L} x2={PLOT_R} y1={BASE_Y} y2={BASE_Y} stroke="rgba(10,12,20,0.28)" strokeWidth={2.5} />

            {winners.map((r, i) => (
              <Column
                key={r.id}
                row={r}
                index={i}
                isTop={i === 0}
                centerX={centerX(i)}
                colW={colW}
                logoSize={logoSize}
                scaleTop={scaleTop}
                mode={mode}
                color={NEON[i % NEON.length]}
                logoBase={dataset.logoBase}
              />
            ))}
          </svg>

          {/* Source — bottom-left, dropped to the very edge */}
          <div style={{ position: "absolute", top: HEIGHT - 32, left: MARGIN, width: PLOT_R - MARGIN, fontFamily: INTER, fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: PALETTE.textVeryDim }}>
            Source: {dataset.source}  ·  as of {dataset.asof}
          </div>
        </AbsoluteFill>

        {/* Soft screen glare */}
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", background: "linear-gradient(122deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 22%, transparent 40%)" }} />

        {/* Ending bloom — a soft lift centered on the winner */}
        {bloom > 0.001 ? (
          <AbsoluteFill
            style={{
              pointerEvents: "none",
              mixBlendMode: "screen",
              opacity: 0.16 * bloom,
              background: `radial-gradient(ellipse 70% 80% at ${((winnerX / WIDTH) * 100).toFixed(1)}% 52%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%)`,
            }}
          />
        ) : null}

        <SnowStatic />
        <VCRBand />
        <CRTVignette />

        {/* Single clean electric-blue border — no RGB split, no vertical bands */}
        <svg width={WIDTH} height={HEIGHT} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <rect x={5} y={5} width={WIDTH - 10} height={HEIGHT - 10} rx={16} fill="none" stroke="#2D5BFF" strokeWidth={4} opacity={0.34 + 0.4 * landFlash} />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const makeCrtBarMeta = (dataset: FlowDataset, id: string) => ({
  id,
  component: () => <CrtBarReel dataset={dataset} />,
  durationInFrames: DURATION,
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
});
