// A square diverging-bar reel: ten protocols in one DefiLlama category, ranked
// by the dollars that flowed in or out of them over a window. Gains reach right
// in gold, losses left in red, zero held at the center. The biggest gainer
// wears the crown. One component, fed a dataset per category — see datasets.ts
// and the lending-curators folder for the inputs.

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

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

export const FLOW_WIDTH = 2160;
export const FLOW_HEIGHT = 2160;
export const FLOW_FPS = 60;
export const FLOW_DURATION = 540;

export type FlowRow = {
  id: string; // logo file stem under `${logoBase}/`
  name: string;
  // Two ways to feed a row:
  //  · live mode  — give now + prior; the bar is the change between them.
  //  · manual mode — give value directly (the growth number you want shown),
  //    plus an optional level for the sublabel (e.g. current TVL).
  now?: number;
  prior?: number;
  value?: number; // overrides now/prior — used verbatim as the bar metric
  level?: number; // size shown in the sublabel; defaults to `now`
  tag?: boolean; // carries the dataset's brand tag (e.g. MORPHO)
};

export type FlowBrand = { logoFile: string; label: string; caption: string };

export type FlowDataset = {
  id: string; // composition id
  eyebrow: string; // e.g. "LAST 7 DAYS"
  title: string;
  subtitle: string;
  source: string;
  asof: string;
  logoBase: string; // e.g. "defi-flows/logos"
  metricNoun?: string; // sublabel noun for the level, default "TVL"
  // What the bar measures: absolute dollar flow ("usd") or percent growth
  // ("pct"). Percent surfaces explosive small movers; dollars surface giants.
  mode?: "usd" | "pct";
  brand?: FlowBrand; // optional top-right lockup
  tagLabel?: string; // e.g. "MORPHO"
  tagColor?: string;
  rows: FlowRow[]; // any order; sorted by the chosen metric here
};

export type FlowMode = "usd" | "pct";

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
  loss: "#D8584F",
  axis: "#E4E7EB",
  baseline: "rgba(255, 255, 255, 0.42)",
  rowHi: "rgba(241, 182, 56, 0.07)",
};

const MARGIN = 120;
const ROWS_TOP = 620;
const ROWS_BOTTOM = 1820;
const PLOT_L = 770;
const PLOT_R = FLOW_WIDTH - MARGIN; // 2040
const X_ZERO = (PLOT_L + PLOT_R) / 2;
const HALF_W = (PLOT_R - PLOT_L) / 2;

export const delta = (r: FlowRow) => (r.now ?? 0) - (r.prior ?? 0);
export const pct = (r: FlowRow) => (r.prior ? (delta(r) / r.prior) * 100 : 0);
export const metricOf = (r: FlowRow, mode: FlowMode) =>
  r.value !== undefined ? r.value : mode === "pct" ? pct(r) : delta(r);
export const levelOf = (r: FlowRow): number | undefined => r.level ?? r.now;

export const fmtUSD = (v: number): string => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export const fmtUsdSigned = (v: number): string => {
  const sign = v >= 0 ? "+" : "−";
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${sign}$${(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${sign}$${(a / 1_000).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
};

const fmtPct = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}%`;
export const fmtPctSigned = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
export const fmtValue = (v: number, mode: FlowMode): string => (mode === "pct" ? fmtPctSigned(v) : fmtUsdSigned(v));

export const niceStep = (max: number): number => {
  const rough = max / 2.5;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * pow;
};

const fmtTick = (t: number, mode: FlowMode): string => {
  if (mode === "pct") return Math.abs(t) < 0.01 ? "0%" : `${t > 0 ? "+" : "−"}${+Math.abs(t).toFixed(0)}%`;
  if (Math.abs(t) < 1) return "$0";
  const sign = t > 0 ? "+" : "−";
  const a = Math.abs(t);
  if (a >= 1_000_000_000) return `${sign}$${+(a / 1_000_000_000).toFixed(2)}B`;
  if (a >= 1_000_000) return `${sign}$${+(a / 1_000_000).toFixed(0)}M`;
  return `${sign}$${+(a / 1_000).toFixed(0)}K`;
};

const GridBackdrop: React.FC = () => {
  const spacing = 120;
  const cols = Math.ceil(FLOW_WIDTH / spacing);
  const rows = Math.ceil(FLOW_HEIGHT / spacing);
  return (
    <AbsoluteFill>
      <svg width={FLOW_WIDTH} height={FLOW_HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="flow-grid-mask" cx="50%" cy="40%" r="64%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="60%" stopColor="white" stopOpacity="0.7" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="flow-grid-fade">
            <rect width={FLOW_WIDTH} height={FLOW_HEIGHT} fill="url(#flow-grid-mask)" />
          </mask>
        </defs>
        <g mask="url(#flow-grid-fade)">
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

const Row: React.FC<{
  row: FlowRow;
  index: number;
  rank: number;
  isTop: boolean;
  rowGap: number;
  rowH: number;
  scaleMax: number;
  mode: FlowMode;
  logoBase: string;
  metricNoun: string;
  tagLabel?: string;
  tagColor?: string;
}> = ({ row, index, rank, isTop, rowGap, rowH, scaleMax, mode, logoBase, metricNoun, tagLabel, tagColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const start = 36 + index * 7;
  const local = frame - start;

  const enter = spring({ frame: local, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 22 });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const slide = interpolate(enter, [0, 1], [-40, 0]);

  const grow = interpolate(local, [10, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });

  const cy = ROWS_TOP + index * rowGap + rowGap / 2;
  const v = metricOf(row, mode);
  const isGain = v >= 0;
  const barColor = isGain ? (isTop ? PALETTE.goldBright : PALETTE.gold) : PALETTE.loss;

  const xForValue = (val: number) => X_ZERO + (val / scaleMax) * HALF_W;
  const fullEnd = xForValue(v);
  const animEnd = X_ZERO + (fullEnd - X_ZERO) * grow;
  const barX = Math.min(X_ZERO, animEnd);
  const barW = Math.abs(animEnd - X_ZERO);

  const labelInside = Math.abs(fullEnd - X_ZERO) > 200;
  const shown = v * grow;
  let labelX: number;
  let labelAnchor: "start" | "end";
  let labelFill: string;
  if (isGain) {
    labelInside
      ? ((labelX = animEnd - 20), (labelAnchor = "end"), (labelFill = PALETTE.onGold))
      : ((labelX = animEnd + 24), (labelAnchor = "start"), (labelFill = PALETTE.goldBright));
  } else {
    labelInside
      ? ((labelX = animEnd + 20), (labelAnchor = "start"), (labelFill = "#FFFFFF"))
      : ((labelX = animEnd - 24), (labelAnchor = "end"), (labelFill = PALETTE.loss));
  }

  const logoSize = 92;
  const nameX = MARGIN + logoSize + 30;
  const crownPulse = isTop ? 1 + 0.06 * Math.sin(Math.max(0, frame - start - 50) / 12) : 1;

  return (
    <div style={{ position: "absolute", inset: 0, opacity, transform: `translateX(${slide}px)` }}>
      {isTop ? (
        <div
          style={{
            position: "absolute",
            top: cy - rowH / 2 - 6,
            left: MARGIN - 28,
            width: FLOW_WIDTH - (MARGIN - 28) * 2,
            height: rowH + 12,
            borderRadius: 28,
            background: PALETTE.rowHi,
            border: "1px solid rgba(241, 182, 56, 0.22)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: cy - logoSize / 2,
          left: MARGIN,
          width: logoSize,
          height: logoSize,
          borderRadius: 24,
          overflow: "hidden",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 14px 34px -22px rgba(0,0,0,0.9)",
          transform: `scale(${crownPulse})`,
        }}
      >
        <Img src={staticFile(`${logoBase}/${row.id}.jpg`)} alt={row.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div style={{ position: "absolute", top: cy - 46, left: nameX, width: PLOT_L - nameX - 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontFamily: INTER, fontSize: 30, fontWeight: 700, color: PALETTE.textVeryDim, fontVariantNumeric: "tabular-nums", width: 44 }}>
            {rank}
          </span>
          <span style={{ fontFamily: INTER, fontSize: 46, fontWeight: 700, letterSpacing: "-0.02em", color: PALETTE.text, whiteSpace: "nowrap" }}>
            {row.name}
          </span>
          {isTop ? <span style={{ fontSize: 38, lineHeight: 1 }}>👑</span> : null}
          {row.tag && tagLabel ? (
            <span
              style={{
                fontFamily: INTER,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: tagColor,
                border: `1.5px solid ${tagColor}`,
                borderRadius: 999,
                padding: "4px 14px",
              }}
            >
              {tagLabel}
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 28, fontWeight: 500, color: PALETTE.textDim, marginTop: 6, marginLeft: 60, whiteSpace: "nowrap" }}>
          {levelOf(row) !== undefined ? `${fmtUSD(levelOf(row) as number)} ${metricNoun}` : null}
          {row.now !== undefined && row.prior !== undefined ? (
            <span style={{ color: PALETTE.textVeryDim }}>{"  ·  "}{mode === "pct" ? fmtUsdSigned(delta(row)) : fmtPct(pct(row))}</span>
          ) : null}
        </div>
      </div>

      <svg width={FLOW_WIDTH} height={FLOW_HEIGHT} style={{ position: "absolute", inset: 0 }}>
        <rect x={barX} y={cy - 23} width={Math.max(0, barW)} height={46} rx={10} fill={barColor} />
        <text
          x={labelX}
          y={cy + 14}
          textAnchor={labelAnchor}
          fontFamily={INTER}
          fontSize={40}
          fontWeight={800}
          letterSpacing="-0.01em"
          fill={labelFill}
          style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
        >
          {fmtValue(shown, mode)}
        </text>
      </svg>
    </div>
  );
};

export const FlowReel: React.FC<{ dataset: FlowDataset }> = ({ dataset }) => {
  const frame = useCurrentFrame();

  const headerEnter = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.smooth,
  });
  const headerLift = interpolate(headerEnter, [0, 1], [36, 0]);

  const mode: FlowMode = dataset.mode ?? "usd";
  const rows = [...dataset.rows].sort((a, b) => metricOf(b, mode) - metricOf(a, mode));
  const rowGap = (ROWS_BOTTOM - ROWS_TOP) / rows.length;
  const rowH = rowGap - 18;

  const maxAbs = Math.max(...rows.map((r) => Math.abs(metricOf(r, mode))));
  const tickStep = niceStep(maxAbs);
  const scaleMax = maxAbs * 1.12;
  const xForValue = (v: number) => X_ZERO + (v / scaleMax) * HALF_W;

  const ticks: number[] = [];
  const maxTick = Math.floor(scaleMax / tickStep) * tickStep;
  for (let t = -maxTick; t <= maxTick + 1; t += tickStep) ticks.push(t);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 100% 70% at 50% 22%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
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

      <div style={{ position: "absolute", top: MARGIN, left: MARGIN, opacity: headerEnter, transform: `translateY(${headerLift}px)` }}>
        <div style={{ fontFamily: INTER, fontSize: 34, fontWeight: 700, letterSpacing: "0.16em", color: PALETTE.gold }}>
          {dataset.eyebrow}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 94, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.0, color: PALETTE.text, marginTop: 18 }}>
          {dataset.title}
        </div>
        <div style={{ fontFamily: INTER, fontSize: 38, fontWeight: 500, letterSpacing: "-0.01em", color: PALETTE.textDim, marginTop: 18, maxWidth: 1280 }}>
          {dataset.subtitle}
        </div>
      </div>

      {dataset.brand ? (
        <div
          style={{
            position: "absolute",
            top: MARGIN + 6,
            right: MARGIN,
            display: "flex",
            alignItems: "center",
            gap: 22,
            opacity: headerEnter,
            transform: `translateY(${headerLift}px)`,
          }}
        >
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: INTER, fontSize: 26, fontWeight: 600, letterSpacing: "0.04em", color: dataset.tagColor ?? PALETTE.gold }}>
              {dataset.brand.label}
            </div>
            <div style={{ fontFamily: INTER, fontSize: 24, fontWeight: 500, color: PALETTE.textVeryDim, marginTop: 4 }}>
              {dataset.brand.caption}
            </div>
          </div>
          <div style={{ width: 96, height: 96, borderRadius: 28, overflow: "hidden", background: "rgba(255,255,255,0.96)", boxShadow: "0 16px 40px -24px rgba(0,0,0,0.9)" }}>
            <Img src={staticFile(dataset.brand.logoFile)} alt={dataset.brand.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
      ) : null}

      <svg width={FLOW_WIDTH} height={FLOW_HEIGHT} style={{ position: "absolute", inset: 0, opacity: headerEnter }}>
        {ticks.map((t) => {
          const x = xForValue(t);
          const isZero = Math.abs(t) < 1;
          return (
            <g key={`tick-${t}`}>
              <line x1={x} x2={x} y1={ROWS_TOP - 26} y2={ROWS_BOTTOM + 8} stroke={isZero ? PALETTE.baseline : PALETTE.gridLine} strokeWidth={isZero ? 3 : 1.5} />
              <text
                x={x}
                y={ROWS_TOP - 44}
                textAnchor="middle"
                fontFamily={INTER}
                fontSize={28}
                fontWeight={600}
                fill={isZero ? PALETTE.axis : PALETTE.textVeryDim}
                style={{ fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
              >
                {fmtTick(t, mode)}
              </text>
            </g>
          );
        })}
      </svg>

      {rows.map((r, i) => (
        <Row
          key={r.id}
          row={r}
          index={i}
          rank={i + 1}
          isTop={i === 0 && metricOf(r, mode) > 0}
          rowGap={rowGap}
          rowH={rowH}
          scaleMax={scaleMax}
          mode={mode}
          logoBase={dataset.logoBase}
          metricNoun={dataset.metricNoun ?? "TVL"}
          tagLabel={dataset.tagLabel}
          tagColor={dataset.tagColor}
        />
      ))}

      <div
        style={{
          position: "absolute",
          top: ROWS_BOTTOM + 92,
          left: MARGIN,
          width: 1360,
          fontFamily: INTER,
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          lineHeight: 1.45,
          color: PALETTE.textVeryDim,
          opacity: headerEnter,
        }}
      >
        Source: {dataset.source}
      </div>

      <div
        style={{
          position: "absolute",
          top: ROWS_BOTTOM + 92,
          right: MARGIN,
          fontFamily: INTER,
          fontSize: 24,
          fontWeight: 600,
          color: PALETTE.textDim,
          opacity: headerEnter,
        }}
      >
        as of {dataset.asof}
      </div>
    </AbsoluteFill>
  );
};

export const makeFlowMeta = (dataset: FlowDataset) => ({
  id: dataset.id,
  component: () => <FlowReel dataset={dataset} />,
  durationInFrames: FLOW_DURATION,
  fps: FLOW_FPS,
  width: FLOW_WIDTH,
  height: FLOW_HEIGHT,
});
