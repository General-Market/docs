/* Featured source cards — the four homepage-style tiles for Rainbows-Pitch
   Scene 10. Mirrors frontend/components/domain/vision/WelcomeHero.tsx
   structure (logo + status pill + sub-market rows + multi-line area chart)
   but rendered statically for a 1920x1080 video frame. Data is baked in at
   build time via scripts/snapshot-rainbows-sources.mjs. */

import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { LightGradient } from "./backgrounds";
import sourcesData from "./data/sources.json";

const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800"],
});

const CHART_COLORS = ["#2563EB", "#059669", "#D97706", "#7C3AED"] as const;

type Market = {
  assetId: string;
  symbol: string;
  name: string;
  value: string;
  changePct: string;
  imageUrl: string | null;
};
type HistoryPoint = { value: number; ts: number };
type SourceData = {
  topMarkets: Market[];
  historyData: Record<string, HistoryPoint[]>;
  marketCount: number;
};

type Card = {
  id: string;
  display: string;
  logoFile: string;
  brandBg: string;
  accent: string;
  valueLabel: string;
  isPrice: boolean;
  isPercent?: boolean;
  smallDecimals?: boolean;
  data: SourceData;
};

const data = sourcesData.sources as Record<string, SourceData>;

const CARDS: Card[] = [
  {
    id: "coingecko",
    display: "CoinGecko",
    logoFile: "source-imgs/new-coingecko.webp",
    brandBg: "#f5f5f5",
    accent: "#8DC73F",
    valueLabel: "Price",
    isPrice: true,
    data: data.coingecko,
  },
  {
    id: "polymarket",
    display: "Polymarket",
    logoFile: "source-imgs/new-polymarket.webp",
    brandBg: "#1b1b1b",
    accent: "#1652f0",
    valueLabel: "Probability",
    isPrice: false,
    isPercent: true,
    data: data.polymarket,
  },
  {
    id: "nyse",
    display: "NYSE Stocks",
    logoFile: "source-imgs/new-finnhub.webp",
    brandBg: "#000000",
    accent: "#1f3a93",
    valueLabel: "Price",
    isPrice: true,
    data: data.nyse,
  },
  {
    id: "pumpfun",
    display: "Pump.fun",
    logoFile: "source-imgs/new-pumpfun.webp",
    brandBg: "linear-gradient(135deg,#00d18c,#1a1a2e)",
    accent: "#00d18c",
    valueLabel: "Price",
    isPrice: true,
    smallDecimals: true,
    data: data.pumpfun,
  },
];

// ── Monotone cubic (Fritsch–Carlson) — matches WelcomeHero MultiLineChart ──
function monotonePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const tg: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    tg.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  tg.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-6) {
      tg[i] = 0;
      tg[i + 1] = 0;
      continue;
    }
    const a = tg[i] / m[i];
    const b = tg[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tg[i] = t * a * m[i];
      tg[i + 1] = t * b * m[i];
    }
  }
  const parts = [`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`];
  for (let i = 0; i < n - 1; i++) {
    const d = dx[i] / 3;
    parts.push(
      `C${(pts[i].x + d).toFixed(2)},${(pts[i].y + tg[i] * d).toFixed(2)} ${(
        pts[i + 1].x - d
      ).toFixed(2)},${(pts[i + 1].y - tg[i + 1] * d).toFixed(2)} ${pts[i + 1].x.toFixed(
        2,
      )},${pts[i + 1].y.toFixed(2)}`,
    );
  }
  return parts.join(" ");
}

function areaPath(line: string, x0: number, x1: number, bottom: number): string {
  return `${line}L${x1.toFixed(2)},${bottom.toFixed(2)}L${x0.toFixed(2)},${bottom.toFixed(
    2,
  )}Z`;
}

// ── Chart ──
function MultiLineChart({
  ids,
  history,
  drawProgress,
}: {
  ids: string[];
  history: Record<string, HistoryPoint[]>;
  drawProgress: number;
}) {
  // Taller viewBox so the SVG fills the rest of the card without leaving
  // a wedge of empty white above the plot. preserveAspectRatio="none" on
  // the <svg> stretches it to whatever the parent gives.
  const W = 460;
  const H = 360;
  const padT = 12;
  const padB = 32;
  const padL = 6;
  const padR = 60;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Per-series resampling. If a series has many points (e.g. CoinGecko's 168
  // hourly samples) we downsample to 48 evenly-spaced buckets. If it's sparse
  // (Yahoo's 5–7 daily closes) we render every point we have — interpolating
  // 5 raw points into 48 buckets produced step-stair artifacts.
  const series: {
    id: string;
    color: string;
    values: number[];
    timestamps: number[];
  }[] = [];
  ids.slice(0, 4).forEach((id, i) => {
    const pts = history[id];
    if (!pts || pts.length < 2) return;
    const SPARSE_LIMIT = 14;
    if (pts.length <= SPARSE_LIMIT) {
      // Use raw points — the spline handles smoothing on its own.
      series.push({
        id,
        color: CHART_COLORS[i],
        values: pts.map((p) => p.value),
        timestamps: pts.map((p) => p.ts),
      });
      return;
    }
    const POINTS = 48;
    const tMin = pts[0].ts;
    const tMax = pts[pts.length - 1].ts;
    const tRange = tMax - tMin || 1;
    const values: number[] = [];
    const timestamps: number[] = [];
    let cursor = 0;
    for (let j = 0; j < POINTS; j++) {
      const target = tMin + (j / (POINTS - 1)) * tRange;
      while (cursor < pts.length - 1 && pts[cursor + 1].ts <= target) cursor++;
      const nearest = pts[cursor];
      const next = cursor < pts.length - 1 ? pts[cursor + 1] : null;
      const closer = next && Math.abs(next.ts - target) < Math.abs(nearest.ts - target) ? next : nearest;
      values.push(closer.value);
      timestamps.push(target);
    }
    series.push({ id, color: CHART_COLORS[i], values, timestamps });
  });

  // Global normalization across all series — preserves the visual ranking
  // (the most-active stream is the tallest line, the cheapest token is the
  // bottom line) which is exactly what the homepage chart conveys. Series
  // sitting flat near the bottom is OK; that's the truth of the data.
  if (series.length === 0) {
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} />;
  }
  const allVals = series.flatMap((s) => s.values);
  const gMin = Math.min(...allVals);
  const gMax = Math.max(...allVals);
  const gRange = gMax - gMin || 1;
  series.forEach((s) => {
    s.values = s.values.map((v) => 0.1 + 0.78 * ((v - gMin) / gRange));
  });

  const toY = (v: number) => padT + plotH * (1 - v);
  const ticks = [0.25, 0.5, 0.75, 1];
  const gridYs = ticks.map(toY);

  const drawn = series.map((raw) => {
    const last = raw.values.length - 1 || 1;
    const pts = raw.values.map((v, j) => ({
      x: padL + (plotW / last) * j,
      y: toY(v),
    }));
    const linePath = monotonePath(pts);
    const fillPath = areaPath(linePath, pts[0].x, pts[pts.length - 1].x, padT + plotH);
    const endPt = pts[pts.length - 1];
    return { ...raw, pts, linePath, fillPath, endPt };
  });

  // X-axis: 4 evenly-spaced date labels — pull from the series with the
  // longest timestamp array so the labels span the actual time window.
  const refTs = series.reduce(
    (best, s) => (s.timestamps.length > best.length ? s.timestamps : best),
    [] as number[],
  );
  const xLabels = [0, 1, 2, 3].map((i) => {
    let label = "";
    if (refTs.length > 0) {
      const idx = Math.round((i / 3) * (refTs.length - 1));
      const d = new Date(refTs[idx]);
      label = d.toLocaleDateString("en", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }
    return { label, x: padL + (plotW / 3) * i };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      <defs>
        {drawn.map((s, i) => (
          <linearGradient key={i} id={`grad-${s.id.replace(/[^a-z0-9]/gi, "")}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
            <stop offset="70%" stopColor={s.color} stopOpacity={0.05} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
        {drawn.map((s, i) => (
          <clipPath key={`clip-${i}`} id={`clip-${s.id.replace(/[^a-z0-9]/gi, "")}-${i}`}>
            <rect
              x={padL}
              y={padT}
              width={plotW * Math.max(0, Math.min(1, drawProgress))}
              height={plotH}
            />
          </clipPath>
        ))}
      </defs>

      {gridYs.map((y, i) => (
        <line
          key={i}
          x1={padL}
          y1={y}
          x2={W - padR}
          y2={y}
          stroke="#E5E7EB"
          strokeWidth={0.5}
          strokeDasharray="1,3"
          shapeRendering="crispEdges"
        />
      ))}

      {drawn.map((s, i) => (
        <path
          key={`fill-${s.id}`}
          d={s.fillPath}
          fill={`url(#grad-${s.id.replace(/[^a-z0-9]/gi, "")}-${i})`}
          clipPath={`url(#clip-${s.id.replace(/[^a-z0-9]/gi, "")}-${i})`}
        />
      ))}
      {drawn.map((s, i) => (
        <path
          key={`line-${s.id}`}
          d={s.linePath}
          fill="none"
          stroke={s.color}
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#clip-${s.id.replace(/[^a-z0-9]/gi, "")}-${i})`}
        />
      ))}
      {drawn.map((s) => {
        const visible = drawProgress >= 0.92;
        return (
          <g key={`end-${s.id}`} opacity={visible ? 1 : 0}>
            <circle cx={s.endPt.x} cy={s.endPt.y} r={4} fill={s.color} />
            <circle cx={s.endPt.x} cy={s.endPt.y} r={7} fill={s.color} fillOpacity={0.18} />
          </g>
        );
      })}
      {xLabels.map((xl, i) => (
        <text
          key={i}
          x={xl.x}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
          fill="#9CA3AF"
          fontSize={11}
          fontWeight={500}
          fontFamily={fontFamily}
        >
          {xl.label}
        </text>
      ))}
    </svg>
  );
}

// ── Value formatting (mirrors frontend/components/domain/vision/WelcomeHero) ──
function formatChange(pct: string): { text: string; color: string } {
  const n = parseFloat(pct);
  if (!isFinite(n) || n === 0) return { text: "0.00%", color: "#9CA3AF" };
  const sign = n > 0 ? "+" : "";
  return {
    text: `${sign}${n.toFixed(2)}%`,
    color: n > 0 ? "#059669" : "#DC2626",
  };
}

function formatValue(v: string, isPrice: boolean, isPercent: boolean, smallDecimals: boolean): string {
  const n = parseFloat(v);
  if (!isFinite(n)) return "—";
  if (isPercent) return `${n.toFixed(1)}%`;
  if (isPrice) {
    if (smallDecimals && n < 0.01) return `$${n.toFixed(7).replace(/0+$/, "0")}`;
    if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    return `$${n.toFixed(4)}`;
  }
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(1);
}

// ── A single card ──
function Card({
  card,
  appear,
  drawProgress,
}: {
  card: Card;
  appear: number;
  drawProgress: number;
}) {
  const { topMarkets, historyData, marketCount } = card.data;
  const ids = topMarkets.map((m) => m.assetId);

  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(180deg, ${card.accent}10 0%, #ffffff 35%, #ffffff 100%)`,
        border: "1px solid #e5e5e5",
        borderRadius: 14,
        boxShadow: `0 24px 60px rgba(15,23,42,${0.12 * appear}), 0 4px 14px rgba(15,23,42,0.05)`,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 22}px) scale(${0.96 + 0.04 * appear})`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${card.accent}, ${card.accent}55)`,
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 24px 14px" }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 14,
            background: card.brandBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        >
          <Img
            src={staticFile(card.logoFile)}
            style={{ maxWidth: "80%", maxHeight: "62%", objectFit: "contain" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span
              style={{
                fontFamily,
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#0a0a0a",
              }}
            >
              {card.display}
            </span>
            <span
              style={{
                fontFamily,
                fontSize: 14,
                fontWeight: 700,
                color: card.accent,
                background: `${card.accent}1a`,
                padding: "4px 12px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: card.accent,
                  boxShadow: `0 0 10px ${card.accent}`,
                }}
              />
              Live
            </span>
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 16,
              fontWeight: 500,
              color: "#71717a",
              marginTop: 4,
            }}
          >
            <span style={{ fontWeight: 700, color: "#18181b", fontVariantNumeric: "tabular-nums" }}>
              {marketCount.toLocaleString()}
            </span>{" "}
            markets · {card.valueLabel}
          </div>
        </div>
      </div>

      {/* Sub-market rows */}
      <div style={{ borderTop: "1px solid #f1f5f9" }}>
        {topMarkets.slice(0, 4).map((m, i) => {
          const change = formatChange(m.changePct);
          const rowAppear = Math.max(0, Math.min(1, (appear - 0.2 - i * 0.08) / 0.4));
          return (
            <div
              key={m.assetId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 24px",
                borderTop: i === 0 ? "none" : "1px solid #f4f4f5",
                opacity: rowAppear,
                transform: `translateX(${(1 - rowAppear) * 8}px)`,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: CHART_COLORS[i],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily,
                  fontSize: 16,
                  fontWeight: 500,
                  color: "#18181b",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.name}
              </span>
              <span
                style={{
                  fontFamily,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0a0a0a",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {formatValue(m.value, card.isPrice, !!card.isPercent, !!card.smallDecimals)}
              </span>
              <span
                style={{
                  fontFamily,
                  fontSize: 14,
                  fontWeight: 600,
                  color: change.color,
                  fontVariantNumeric: "tabular-nums",
                  width: 80,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {change.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div
        style={{
          flex: 1,
          padding: "12px 12px 6px",
          borderTop: "1px solid #f1f5f9",
          background: `linear-gradient(180deg, transparent 0%, ${card.accent}08 100%)`,
          minHeight: 320,
        }}
      >
        <MultiLineChart ids={ids} history={historyData} drawProgress={drawProgress} />
      </div>
    </div>
  );
}

// ── Scene root ──
export const FeaturedSourceCardsScene: React.FC = () => {
  const frame = useCurrentFrame();
  // Stagger appearance: card i starts at frame 2 + i*4, eases in over 14 frames.
  const cardAppears = CARDS.map((_, i) =>
    interpolate(frame, [2 + i * 4, 2 + i * 4 + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // Chart line-draw progress — global, completes by ~frame 42
  const drawProgress = interpolate(frame, [18, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <LightGradient />
      <div
        style={{
          position: "absolute",
          inset: 36,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 22,
        }}
      >
        {CARDS.map((card, i) => (
          <Card key={card.id} card={card} appear={cardAppears[i]} drawProgress={drawProgress} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
