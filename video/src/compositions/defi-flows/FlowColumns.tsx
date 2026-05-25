// Winners-only vertical column reel. Same chrome as RetailPnLMarketsReel — dark
// radial ground, dotted grid, gold glow — but the growth stands up as columns
// instead of lying down as bars. Only the protocols that GREW over the window
// are shown; the decliners are dropped. Fed the same FlowDataset as FlowReel.

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
import {
  fmtUSD,
  fmtValue,
  FLOW_DURATION,
  FLOW_FPS,
  FLOW_HEIGHT,
  FLOW_WIDTH,
  type FlowDataset,
  type FlowMode,
  type FlowRow,
  metricOf,
  niceStep,
} from "./FlowReel";

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

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
  onGold: "#15171C",
  axis: "#E4E7EB",
  grid: "rgba(255, 255, 255, 0.10)",
  baseline: "rgba(255, 255, 255, 0.42)",
  morpho: "#5B7CFA",
};

const MARGIN = 120;
const PLOT_L = 240;
const PLOT_R = FLOW_WIDTH - 120; // 2040
const PLOT_W = PLOT_R - PLOT_L;
const BASE_Y = 1500;
const MAX_H = 880; // tallest column height
const COL_W_CAP = 280;

const fmtAxis = (t: number, mode: FlowMode): string => {
  if (Math.abs(t) < 1e-9) return mode === "pct" ? "0%" : "$0";
  return mode === "pct" ? `${+t.toFixed(0)}%` : fmtUSD(t);
};

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(FLOW_WIDTH / spacing);
  const rows = Math.ceil(FLOW_HEIGHT / spacing);
  return (
    <AbsoluteFill>
      <svg width={FLOW_WIDTH} height={FLOW_HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="col-grid-mask" cx="50%" cy="42%" r="64%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="col-grid-fade">
            <rect width={FLOW_WIDTH} height={FLOW_HEIGHT} fill="url(#col-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#col-grid-fade)">
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line key={`h-${r}`} x1={0} y1={r * spacing} x2={FLOW_WIDTH} y2={r * spacing} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line key={`v-${c}`} x1={c * spacing} y1={0} x2={c * spacing} y2={FLOW_HEIGHT} stroke={PALETTE.gridLine} strokeWidth={1.2} />
          ))}
          {Array.from({ length: rows + 1 }).flatMap((_, r) =>
            Array.from({ length: cols + 1 }).map((__, c) => (
              <circle key={`d-${r}-${c}`} cx={c * spacing} cy={r * spacing} r={2.5} fill={PALETTE.gridDot} />
            )),
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const Column: React.FC<{
  row: FlowRow;
  index: number;
  isTop: boolean;
  centerX: number;
  colW: number;
  scaleTop: number;
  mode: FlowMode;
  metricNoun: string;
  logoBase: string;
}> = ({ row, index, isTop, centerX, colW, scaleTop, mode, metricNoun, logoBase }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const start = 30 + index * 9;
  const local = frame - start;

  const rise = spring({ frame: local, fps, config: { damping: 16, stiffness: 90, mass: 1 }, durationInFrames: 46 });
  const grow = Math.max(0, rise);
  const fade = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const v = metricOf(row, mode);
  const fullH = (v / scaleTop) * MAX_H;
  const h = fullH * grow;
  const top = BASE_Y - h;

  const logoSize = 128;
  const crownPulse = isTop ? 1 + 0.05 * Math.sin(Math.max(0, local - 50) / 11) : 1;

  return (
    <g opacity={fade}>
      {/* glow behind the column */}
      <rect x={centerX - colW / 2} y={top} width={colW} height={h} rx={18} fill={PALETTE.goldBright} opacity={isTop ? 0.5 : 0.32} filter="url(#col-glow)" />
      {/* the column */}
      <rect x={centerX - colW / 2} y={top} width={colW} height={h} rx={18} fill="url(#col-fill)" />
      {!isTop ? <rect x={centerX - colW / 2} y={top} width={colW} height={h} rx={18} fill="rgba(0,0,0,0.14)" /> : null}

      {/* value on top of the column */}
      <text
        x={centerX}
        y={top - 34}
        textAnchor="middle"
        fontFamily={INTER}
        fontSize={isTop ? 76 : 58}
        fontWeight={800}
        letterSpacing="-0.02em"
        fill={isTop ? PALETTE.goldBright : PALETTE.gold}
        opacity={interpolate(grow, [0.25, 0.55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
      >
        {fmtValue(v * grow, mode)}
      </text>
      {isTop ? (
        <text x={centerX} y={top - 122} textAnchor="middle" fontSize={64} opacity={interpolate(grow, [0.5, 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
          👑
        </text>
      ) : null}

      {/* logo chip below the baseline */}
      <foreignObject x={centerX - logoSize / 2} y={BASE_Y + 34} width={logoSize} height={logoSize}>
        <div
          style={{
            width: logoSize,
            height: logoSize,
            borderRadius: 30,
            overflow: "hidden",
            background: "rgba(255,255,255,0.96)",
            boxShadow: "0 16px 40px -24px rgba(0,0,0,0.9)",
            transform: `scale(${crownPulse})`,
          }}
        >
          <Img src={staticFile(`${logoBase}/${row.id}.jpg`)} alt={row.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </foreignObject>

      {/* name + level below the logo */}
      <foreignObject x={centerX - colW / 2 - 40} y={BASE_Y + 34 + logoSize + 18} width={colW + 80} height={140}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em", color: PALETTE.text, lineHeight: 1.05 }}>
            {row.name}
          </div>
          <div style={{ fontFamily: INTER, fontSize: 27, fontWeight: 500, color: PALETTE.textVeryDim, marginTop: 8 }}>
            {fmtUSD(row.now)} {metricNoun}
          </div>
        </div>
      </foreignObject>
    </g>
  );
};

export const FlowColumns: React.FC<{ dataset: FlowDataset }> = ({ dataset }) => {
  const frame = useCurrentFrame();
  const mode: FlowMode = dataset.mode ?? "usd";
  const metricNoun = dataset.metricNoun ?? "TVL";

  const headerEnter = interpolate(frame, [0, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.smooth });
  const headerLift = interpolate(headerEnter, [0, 1], [36, 0]);

  const winners = dataset.rows.filter((r) => metricOf(r, mode) > 0).sort((a, b) => metricOf(b, mode) - metricOf(a, mode));
  const n = winners.length;
  const maxV = metricOf(winners[0], mode);
  const step = niceStep(maxV);
  const scaleTop = Math.ceil((maxV * 1.04) / step) * step;

  const slot = PLOT_W / n;
  const colW = Math.min(COL_W_CAP, slot * 0.54);
  const centerX = (i: number) => PLOT_L + slot * (i + 0.5);

  const ticks: number[] = [];
  for (let t = 0; t <= scaleTop + 1e-9; t += step) ticks.push(t);
  const yFor = (v: number) => BASE_Y - (v / scaleTop) * MAX_H;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 100% 70% at 50% 22%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`, fontFamily: INTER }}>
      <GridBackdrop />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 45%, transparent 0%, transparent 50%, ${PALETTE.bgBottom} 100%)`, pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ position: "absolute", top: MARGIN, left: MARGIN, opacity: headerEnter, transform: `translateY(${headerLift}px)` }}>
        <div style={{ fontFamily: INTER, fontSize: 34, fontWeight: 700, letterSpacing: "0.16em", color: PALETTE.gold }}>{dataset.eyebrow}</div>
        <div style={{ fontFamily: INTER, fontSize: 94, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0, color: PALETTE.text, marginTop: 18 }}>
          {dataset.title}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 500, letterSpacing: "-0.01em", color: PALETTE.textDim, marginTop: 18, maxWidth: 1280 }}>
          The winners only — who grew over the window.
        </div>
      </div>

      {dataset.brand ? (
        <div style={{ position: "absolute", top: MARGIN + 6, right: MARGIN, display: "flex", alignItems: "center", gap: 22, opacity: headerEnter, transform: `translateY(${headerLift}px)` }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: INTER, fontSize: 26, fontWeight: 600, letterSpacing: "0.04em", color: dataset.tagColor ?? PALETTE.gold }}>{dataset.brand.label}</div>
            <div style={{ fontFamily: INTER, fontSize: 24, fontWeight: 500, color: PALETTE.textVeryDim, marginTop: 4 }}>{dataset.brand.caption}</div>
          </div>
          <div style={{ width: 96, height: 96, borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.96)", boxShadow: "0 16px 40px -24px rgba(0,0,0,0.9)" }}>
            <Img src={staticFile(dataset.brand.logoFile)} alt={dataset.brand.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      ) : null}

      <svg width={FLOW_WIDTH} height={FLOW_HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="col-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBCB57" />
            <stop offset="100%" stopColor="#E0A21F" />
          </linearGradient>
          <filter id="col-glow" x="-60%" y="-30%" width="220%" height="160%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        {/* y gridlines + axis labels */}
        <g opacity={headerEnter}>
          {ticks.map((t) => {
            const y = yFor(t);
            const isZero = t < 1e-9;
            return (
              <g key={`t-${t}`}>
                <line x1={PLOT_L - 20} x2={PLOT_R} y1={y} y2={y} stroke={isZero ? PALETTE.baseline : PALETTE.grid} strokeWidth={isZero ? 3 : 1.5} />
                <text x={PLOT_L - 38} y={y + 16} textAnchor="end" fontFamily={INTER} fontSize={40} fontWeight={600} fill={PALETTE.axis} style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}>
                  {fmtAxis(t, mode)}
                </text>
              </g>
            );
          })}
        </g>

        {winners.map((r, i) => (
          <Column
            key={r.id}
            row={r}
            index={i}
            isTop={i === 0}
            centerX={centerX(i)}
            colW={colW}
            scaleTop={scaleTop}
            mode={mode}
            metricNoun={metricNoun}
            logoBase={dataset.logoBase}
          />
        ))}
      </svg>

      {/* Source + as-of */}
      <div style={{ position: "absolute", top: 1980, left: MARGIN, width: 1360, fontFamily: INTER, fontSize: 24, fontWeight: 500, lineHeight: 1.45, color: PALETTE.textVeryDim, opacity: headerEnter }}>
        Source: {dataset.source}
      </div>
      <div style={{ position: "absolute", top: 1980, right: MARGIN, fontFamily: INTER, fontSize: 24, fontWeight: 600, color: PALETTE.textDim, opacity: headerEnter }}>
        as of {dataset.asof}
      </div>
    </AbsoluteFill>
  );
};

export const makeColumnsMeta = (dataset: FlowDataset, id: string) => ({
  id,
  component: () => <FlowColumns dataset={dataset} />,
  durationInFrames: FLOW_DURATION,
  fps: FLOW_FPS,
  width: FLOW_WIDTH,
  height: FLOW_HEIGHT,
});
