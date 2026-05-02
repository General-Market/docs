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
  /** Sub-row image rendering shape — round avatars (coins, streamers) vs
      square thumbs (game banners, market posters) vs flat ticker pills. */
  rowImageShape?: "round" | "square" | "ticker";
  /** Background colour for ticker-pill fallback (pumpfun, db_trains, etc.). */
  tickerBadgeBg?: string;
  /** Foreground colour for ticker-pill fallback. */
  tickerBadgeFg?: string;
  data: SourceData;
};

const data = sourcesData.sources as Record<string, SourceData>;

const FINANCE_CARDS: Card[] = [
  {
    id: "coingecko",
    display: "CoinGecko",
    logoFile: "source-imgs/new-coingecko.webp",
    brandBg: "#f5f5f5",
    accent: "#8DC73F",
    valueLabel: "Price",
    isPrice: true,
    rowImageShape: "round",
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
    rowImageShape: "square",
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
    rowImageShape: "round",
    tickerBadgeBg: "#1f3a93",
    tickerBadgeFg: "#ffffff",
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
    rowImageShape: "ticker",
    tickerBadgeBg: "#00d18c",
    tickerBadgeFg: "#0a0a0a",
    data: data.pumpfun,
  },
];

const VARIETY_CARDS: Card[] = [
  {
    id: "twitch",
    display: "Twitch",
    logoFile: "source-imgs/new-twitch.webp",
    brandBg: "#9146FF",
    accent: "#9146FF",
    valueLabel: "Viewers",
    isPrice: false,
    rowImageShape: "square",
    data: data.twitch,
  },
  {
    id: "db_trains",
    display: "Deutsche Bahn",
    logoFile: "source-imgs/new-dbtrains.svg",
    brandBg: "#ec0016",
    accent: "#ec0016",
    valueLabel: "Avg Delay",
    isPrice: false,
    rowImageShape: "ticker",
    tickerBadgeBg: "#ec0016",
    tickerBadgeFg: "#ffffff",
    data: data.db_trains,
  },
  {
    id: "steam",
    display: "Steam",
    logoFile: "source-imgs/new-steam.webp",
    brandBg: "#171a21",
    accent: "#1b6ee8",
    valueLabel: "Players",
    isPrice: false,
    rowImageShape: "square",
    data: data.steam,
  },
  {
    id: "animals",
    display: "Wildlife",
    logoFile: "source-imgs/new-inaturalist.svg",
    brandBg: "#74AC00",
    accent: "#74AC00",
    valueLabel: "Observations",
    isPrice: false,
    rowImageShape: "ticker",
    tickerBadgeBg: "#74AC00",
    tickerBadgeFg: "#ffffff",
    data: data.animals,
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

  // Per-series % normalization — each line uses its own min/max, so a stock
  // that drifts 0.5% in a week and a memecoin that doubles overnight both
  // show their movement at full plot height. Visualizes change, not absolute
  // value. Series occupy the same vertical band; movement is what matters.
  if (series.length === 0) {
    return <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }} />;
  }
  series.forEach((s) => {
    const min = Math.min(...s.values);
    const max = Math.max(...s.values);
    const range = max - min || Math.max(Math.abs(max), 1);
    s.values = s.values.map((v) => 0.12 + 0.74 * ((v - min) / range));
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

// ── Sub-row avatar — image when we have one, ticker pill otherwise ──
function SubRowAvatar({
  market,
  card,
  shape,
}: {
  market: Market;
  card: Card;
  shape: "round" | "square" | "ticker";
}) {
  const SIZE = 30;
  const ticker = (market.symbol || market.assetId || "").toUpperCase();
  const tickerShort = ticker.replace(/^(STOCK_|PF:|TWITCH_GAME_|STEAM#|WILD\/|DB_)/, "").slice(0, 5);

  if (shape !== "ticker" && market.imageUrl) {
    const radius = shape === "round" ? "50%" : 7;
    // imageUrl is a relative path under public/ after the prefetch pass —
    // wrap it with staticFile so the bundler resolves to the local file.
    const src = market.imageUrl.startsWith("http")
      ? market.imageUrl
      : staticFile(market.imageUrl);
    return (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: radius,
          background: "#f1f4f7",
          overflow: "hidden",
          flexShrink: 0,
          border: "1px solid rgba(15,23,42,0.06)",
        }}
      >
        <Img
          src={src}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  // Ticker pill fallback
  const bg = card.tickerBadgeBg ?? card.accent;
  const fg = card.tickerBadgeFg ?? "#ffffff";
  return (
    <div
      style={{
        height: SIZE,
        minWidth: SIZE,
        padding: "0 8px",
        borderRadius: 7,
        background: bg,
        color: fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.10)",
      }}
    >
      {tickerShort}
    </div>
  );
}

// ── A single card ──
function Card({
  card,
  appear,
  drawProgress,
  aliveProgress = 1,
}: {
  card: Card;
  appear: number;
  drawProgress: number;
  /** 0 = blocked / "no exchange lists this", 1 = fully live with data */
  aliveProgress?: number;
}) {
  const { topMarkets, historyData, marketCount } = card.data;
  const ids = topMarkets.map((m) => m.assetId);
  const dead = 1 - aliveProgress;

  return (
    <div
      style={{
        position: "relative",
        background: `linear-gradient(180deg, ${card.accent}10 0%, #ffffff 35%, #ffffff 100%)`,
        border: `1px solid ${dead > 0.5 ? "#d4d4d4" : "#e5e5e5"}`,
        borderRadius: 14,
        boxShadow: `0 24px 60px rgba(15,23,42,${0.12 * appear * aliveProgress}), 0 4px 14px rgba(15,23,42,0.05)`,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 22}px) scale(${0.96 + 0.04 * appear})`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        filter: `grayscale(${dead * 0.9}) brightness(${1 - dead * 0.18})`,
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
      <div style={{ borderTop: "1px solid #eef0f3" }}>
        {topMarkets.slice(0, 4).map((m, i) => {
          const change = formatChange(m.changePct);
          const rowAppear = Math.max(0, Math.min(1, (appear - 0.2 - i * 0.08) / 0.4));
          const shape = card.rowImageShape ?? "round";
          const positive = parseFloat(m.changePct) >= 0;
          const changeBg = positive ? "rgba(16,185,129,0.10)" : "rgba(220,38,38,0.10)";
          return (
            <div
              key={m.assetId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 24px",
                borderTop: i === 0 ? "none" : "1px solid #f1f4f7",
                opacity: rowAppear,
                transform: `translateX(${(1 - rowAppear) * 8}px)`,
              }}
            >
              {/* Series colour dot — anchors the row to its chart line */}
              <span
                style={{
                  width: 4,
                  height: 28,
                  borderRadius: 2,
                  background: CHART_COLORS[i],
                  flexShrink: 0,
                }}
              />
              {/* Asset image / ticker pill */}
              <SubRowAvatar market={m} card={card} shape={shape} />
              <span
                style={{
                  fontFamily,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#18181b",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.01em",
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
                  letterSpacing: "-0.01em",
                }}
              >
                {formatValue(m.value, card.isPrice, !!card.isPercent, !!card.smallDecimals)}
              </span>
              <span
                style={{
                  fontFamily,
                  fontSize: 12,
                  fontWeight: 700,
                  color: change.color,
                  background: changeBg,
                  fontVariantNumeric: "tabular-nums",
                  padding: "3px 7px",
                  borderRadius: 5,
                  minWidth: 76,
                  textAlign: "right",
                  flexShrink: 0,
                  letterSpacing: "-0.01em",
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

      {/* Dead-state overlay — diagonal red strike + "Not listed" stamp.
          Fades out as aliveProgress climbs to 1. */}
      {dead > 0.02 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: dead,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "-8%",
              right: "-8%",
              height: 10,
              background: "linear-gradient(90deg, transparent, #ff3b3b 12%, #ff3b3b 88%, transparent)",
              transform: "rotate(-9deg)",
              transformOrigin: "center",
              boxShadow: "0 0 18px rgba(255,59,59,0.55)",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              padding: "5px 12px",
              background: "rgba(255,59,59,0.92)",
              color: "#fff",
              fontFamily,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              borderRadius: 6,
              boxShadow: "0 4px 14px rgba(255,59,59,0.35)",
            }}
          >
            Not Listed
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scene root — finance variant (no before/after) ──
export const FeaturedSourceCardsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const cardAppears = FINANCE_CARDS.map((_, i) =>
    interpolate(frame, [2 + i * 4, 2 + i * 4 + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
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
          gridTemplateRows: "1fr",
          gap: 22,
        }}
      >
        {FINANCE_CARDS.map((card, i) => (
          <Card key={card.id} card={card} appear={cardAppears[i]} drawProgress={drawProgress} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene root — variety variant with before/after ──
//   Phase 1 (0–32):  cards visible but greyed-out, "Not Listed" stamps.
//                    Headline: "Markets no exchange will list."
//   Phase 2 (32–46): rainbow wipe sweeps left→right, cards bloom to colour
//                    in its wake.
//   Phase 3 (46–84): cards alive, charts complete drawing, headline becomes
//                    "Until Rainbows."
const RAINBOW_GRADIENT =
  "linear-gradient(90deg, #ff3b3b 0%, #ff8a00 18%, #ffd400 36%, #2cd36f 54%, #2dabff 72%, #7e3bff 88%, #ff3bd1 100%)";

export const FeaturedVarietyCardsScene: React.FC = () => {
  const frame = useCurrentFrame();

  // All four cards land together in phase 1 — they're props, not the reveal.
  const cardAppear = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cards come alive in a left-to-right cascade timed to the rainbow sweep.
  // i=0,1 (left col) at frame 34; i=2,3 (right col) at frame 40.
  const aliveProgresses = VARIETY_CARDS.map((_, i) => {
    const isRight = i % 2 === 1;
    const start = isRight ? 38 : 32;
    return interpolate(frame, [start, start + 8], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  });

  // Chart strokes only paint after the card is alive.
  const drawProgress = interpolate(frame, [44, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rainbow sweep: a tilted full-height bar travels across the canvas.
  const sweepX = interpolate(frame, [28, 50], [-30, 130], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sweepOpacity = interpolate(frame, [28, 32, 46, 50], [0, 0.85, 0.85, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Headline transition.
  const before = interpolate(frame, [0, 6, 30, 36], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const after = interpolate(frame, [42, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <LightGradient />

      {/* Headline — swaps mid-scene */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily,
          fontWeight: 800,
          fontStyle: "italic",
          fontSize: 52,
          color: "#0a0a0a",
          letterSpacing: "-0.02em",
          height: 64,
        }}
      >
        <span style={{ position: "absolute", left: 0, right: 0, opacity: before }}>
          Markets no exchange will list.
        </span>
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            opacity: after,
            backgroundImage: RAINBOW_GRADIENT,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Until Rainbows.
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 116,
          left: 36,
          right: 36,
          bottom: 36,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          gap: 28,
        }}
      >
        {VARIETY_CARDS.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            appear={cardAppear}
            drawProgress={drawProgress}
            aliveProgress={aliveProgresses[i]}
          />
        ))}
      </div>

      {/* Rainbow wipe — tilted vertical bar that traverses the canvas */}
      {sweepOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${sweepX}%`,
            width: "32%",
            backgroundImage: RAINBOW_GRADIENT,
            opacity: sweepOpacity,
            transform: "skewX(-10deg)",
            filter: "blur(28px)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
