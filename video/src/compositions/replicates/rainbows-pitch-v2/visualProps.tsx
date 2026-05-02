/* Shared visual props for Rainbows-Pitch-V2 — schematic icons, mock UI panels,
 * and decorative chrome that lift the bare-text scenes into the Postman/Algolia
 * register. Each component is purely presentational; animation timing lives in
 * the calling scene. Self-contained — no external assets required. */

import React from "react";
import { useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "500", "700", "800"] });
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

const RAINBOW =
  "linear-gradient(90deg, #ff3b3b 0%, #ff8a00 18%, #ffd400 36%, #2cd36f 54%, #2dabff 72%, #7e3bff 88%, #ff3bd1 100%)";

/* ── Isometric prism — small refractor in a corner ─────────────── */
export const PrismIcon: React.FC<{ size?: number; opacity?: number }> = ({
  size = 130,
  opacity = 1,
}) => {
  const w = size;
  const h = size * 0.95;
  return (
    <svg width={w} height={h} viewBox="0 0 130 124" style={{ opacity }}>
      <defs>
        <linearGradient id="prism-rb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff3b3b" />
          <stop offset="20%" stopColor="#ff8a00" />
          <stop offset="40%" stopColor="#ffd400" />
          <stop offset="60%" stopColor="#2cd36f" />
          <stop offset="80%" stopColor="#2dabff" />
          <stop offset="100%" stopColor="#7e3bff" />
        </linearGradient>
      </defs>
      {/* incoming white ray */}
      <line x1="0" y1="62" x2="34" y2="62" stroke="#fff" strokeWidth="2.2" opacity="0.85" />
      {/* prism faces */}
      <polygon points="34,30 96,62 34,94" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
      <polygon points="34,30 34,94 24,86 24,38" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      {/* refracted rainbow fan */}
      {[-22, -12, 0, 12, 22].map((dy, i) => (
        <line
          key={i}
          x1="92"
          y1={62 + dy * 0.3}
          x2="128"
          y2={62 + dy}
          stroke="url(#prism-rb)"
          strokeWidth={1.6}
          opacity={0.85 - Math.abs(i - 2) * 0.1}
        />
      ))}
    </svg>
  );
};

/* ── BLS signature badge — monospace tilted plate ─────────────── */
export const BLSBadge: React.FC<{ opacity?: number; rotate?: number }> = ({
  opacity = 1,
  rotate = -8,
}) => (
  <div
    style={{
      opacity,
      transform: `rotate(${rotate}deg)`,
      padding: "10px 16px",
      background: "rgba(0,0,0,0.6)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: 8,
      fontFamily: MONO,
      color: "#fff",
      letterSpacing: "0.06em",
      boxShadow: "0 0 32px rgba(126,59,255,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
      backdropFilter: "blur(2px)",
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>
      BLS · 3-of-3 SIGNED
    </div>
    <div style={{ fontSize: 14, fontWeight: 700 }}>0x8f3a…c2e1</div>
  </div>
);

/* ── Node graph — Algolia-style: center node with three labeled chips ── */
export const NodeGraph: React.FC<{
  centerLabel?: string;
  chips: ReadonlyArray<{ label: string; struck: number; appear: number }>;
  scale?: number;
}> = ({ centerLabel = "ORDER", chips, scale = 1 }) => {
  const cx = 0;
  const cy = 0;
  const r = 280;
  const positions = [
    { x: cx + r * Math.cos(Math.PI * 1.15), y: cy + r * Math.sin(Math.PI * 1.15) },
    { x: cx + r * 0.95, y: cy - r * 0.05 },
    { x: cx + r * Math.cos(Math.PI * 0.30), y: cy + r * Math.sin(Math.PI * 0.30) },
  ];
  return (
    <div style={{ position: "relative", transform: `scale(${scale})` }}>
      {/* Center node */}
      <div
        style={{
          position: "absolute",
          left: cx - 90,
          top: cy - 90,
          width: 180,
          height: 180,
          borderRadius: 24,
          background: "rgba(45, 171, 255, 0.18)",
          border: "1.5px solid rgba(45, 171, 255, 0.7)",
          boxShadow: "0 0 60px rgba(45,171,255,0.45), inset 0 0 40px rgba(45,171,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily,
          fontSize: 28,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "0.04em",
        }}
      >
        {centerLabel}
      </div>

      {/* Edges (SVG, drawn first so chips overlap) */}
      <svg
        width={1400}
        height={900}
        style={{ position: "absolute", left: -700, top: -450, pointerEvents: "none" }}
      >
        {chips.map((chip, i) => {
          const pos = positions[i]!;
          const a = chip.appear;
          return (
            <line
              key={i}
              x1={700}
              y1={450}
              x2={700 + pos.x * a}
              y2={450 + pos.y * a}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={2}
              strokeDasharray="4 6"
              opacity={a}
            />
          );
        })}
      </svg>

      {/* Chips */}
      {chips.map((chip, i) => {
        const pos = positions[i]!;
        const struck = chip.struck;
        return (
          <div
            key={chip.label}
            style={{
              position: "absolute",
              left: pos.x - 100,
              top: pos.y - 30,
              padding: "16px 26px",
              borderRadius: 999,
              background: struck > 0.5 ? "rgba(255, 42, 42, 0.18)" : "#2cd36f",
              border: struck > 0.5 ? "1.5px solid #ff2a2a" : "1.5px solid #2cd36f",
              boxShadow: struck > 0.5
                ? "0 0 24px rgba(255,42,42,0.45)"
                : "0 0 24px rgba(44,211,111,0.45)",
              fontFamily,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: struck > 0.5 ? "#ff8a8a" : "#0a2a14",
              opacity: chip.appear,
              whiteSpace: "nowrap",
              minWidth: 200,
              textAlign: "center",
            }}
          >
            {chip.label}
            {struck > 0.05 && (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  top: "50%",
                  height: 3,
                  background: "#ff2a2a",
                  boxShadow: "0 0 10px rgba(255,42,42,0.7)",
                  borderRadius: 2,
                  transform: `translateY(-50%) scaleX(${struck})`,
                  transformOrigin: "left center",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Stacked bars — "clean" vs "current" ─────────────────────── */
export const StackedBars: React.FC<{
  fill: number; // 0..1 — how much of the gap is rainbow-filled
  opacity?: number;
}> = ({ fill, opacity = 1 }) => {
  const W = 1200;
  const H = 720;
  const barW = 220;
  const left = 200;
  const right = W - 200 - barW;
  const fullH = 600;
  const partialH = fullH * 0.30;
  return (
    <svg width={W} height={H} style={{ opacity }}>
      <defs>
        <linearGradient id="bars-rb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff3b3b" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#2cd36f" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7e3bff" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1={left - 40} y1={H - 40} x2={right + barW + 40} y2={H - 40} stroke="rgba(0,0,0,0.25)" strokeWidth={1.2} />

      {/* left bar — full clean profit */}
      <rect x={left} y={H - 40 - fullH} width={barW} height={fullH} fill="rgba(0,0,0,0.06)" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5} />
      <text x={left + barW / 2} y={H - 40 - fullH - 18} textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={20} fill="rgba(0,0,0,0.6)">
        CLEAN MARKET
      </text>
      <text x={left + barW / 2} y={H - 14} textAnchor="middle" fontFamily={fontFamily} fontSize={18} fill="rgba(0,0,0,0.55)">
        100% reaches you
      </text>

      {/* right bar — partial */}
      <rect x={right} y={H - 40 - partialH} width={barW} height={partialH} fill="rgba(0,0,0,0.06)" stroke="rgba(0,0,0,0.35)" strokeWidth={1.5} />
      <text x={right + barW / 2} y={H - 40 - partialH - 18} textAnchor="middle" fontFamily={fontFamily} fontWeight={700} fontSize={20} fill="rgba(0,0,0,0.6)">
        CURRENT MARKET
      </text>
      <text x={right + barW / 2} y={H - 14} textAnchor="middle" fontFamily={fontFamily} fontSize={18} fill="rgba(0,0,0,0.55)">
        30% reaches you
      </text>

      {/* the missing 70% on the right bar — rainbow-filled as `fill` rises */}
      <rect
        x={right}
        y={(H - 40 - partialH) - (fullH - partialH) * fill}
        width={barW}
        height={(fullH - partialH) * fill}
        fill="url(#bars-rb)"
      />
      <line
        x1={right - 14}
        y1={H - 40 - fullH}
        x2={right + barW + 14}
        y2={H - 40 - fullH}
        stroke="#000"
        strokeDasharray="6 4"
        strokeWidth={1.2}
        opacity={0.4}
      />
      {/* arrow connecting clean → missing 70% */}
      <line
        x1={left + barW + 30}
        y1={H - 40 - fullH * 0.65}
        x2={right - 30}
        y2={H - 40 - fullH * 0.65}
        stroke="rgba(0,0,0,0.5)"
        strokeWidth={1.5}
        markerEnd="url(#arrow-head)"
      />
      <defs>
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(0,0,0,0.5)" />
        </marker>
      </defs>
    </svg>
  );
};

/* ── Mock orderbook panel — Vision-style frame ─────────────────────── */
type OrderRow = { price: string; size: string; side: "bid" | "ask"; ghost: number };

export const MockOrderbook: React.FC<{
  width?: number;
  height?: number;
  ghostStrength: number; // 0..1 — how many red rows are dropping out
}> = ({ width = 620, height = 760, ghostStrength }) => {
  const asks: OrderRow[] = [
    { price: "108,512.40", size: "0.42", side: "ask", ghost: 0 },
    { price: "108,510.10", size: "1.15", side: "ask", ghost: 0.95 },
    { price: "108,508.85", size: "0.07", side: "ask", ghost: 0 },
    { price: "108,506.20", size: "2.84", side: "ask", ghost: 0.6 },
    { price: "108,504.00", size: "0.31", side: "ask", ghost: 0 },
    { price: "108,502.75", size: "5.12", side: "ask", ghost: 0.85 },
    { price: "108,500.00", size: "0.94", side: "ask", ghost: 0 },
  ];
  const bids: OrderRow[] = [
    { price: "108,498.50", size: "0.66", side: "bid", ghost: 0 },
    { price: "108,496.10", size: "3.21", side: "bid", ghost: 0.7 },
    { price: "108,493.80", size: "0.18", side: "bid", ghost: 0 },
    { price: "108,491.20", size: "1.04", side: "bid", ghost: 0.4 },
    { price: "108,488.55", size: "0.83", side: "bid", ghost: 0 },
    { price: "108,485.00", size: "4.40", side: "bid", ghost: 0.92 },
    { price: "108,482.10", size: "0.27", side: "bid", ghost: 0 },
  ];

  const Row = ({ r }: { r: OrderRow }) => {
    const dropY = r.ghost * 24 * ghostStrength;
    const fade = 1 - r.ghost * ghostStrength;
    const bg = r.side === "ask" ? "rgba(239,83,80,0.10)" : "rgba(38,166,154,0.10)";
    const color = r.side === "ask" ? "#ef5350" : "#26a69a";
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 90px",
          padding: "8px 14px",
          fontFamily: MONO,
          fontSize: 14,
          color: "rgba(255,255,255,0.85)",
          background: bg,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          opacity: fade,
          transform: `translateY(${dropY}px)`,
          transition: "none",
        }}
      >
        <span style={{ color }}>{r.price}</span>
        <span style={{ textAlign: "right", color: "rgba(255,255,255,0.65)" }}>{r.size}</span>
        <span style={{ textAlign: "right", color: "rgba(255,255,255,0.45)" }}>
          {(parseFloat(r.size) * parseFloat(r.price.replace(/,/g, ""))).toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        width,
        height,
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        fontFamily,
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          height: 44,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(13,17,23,0.96)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28c840" }} />
        <span style={{ marginLeft: 16, color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700 }}>
          BTC-PERP · ORDER BOOK
        </span>
        <span style={{ marginLeft: "auto", color: "#26a69a", fontSize: 13, fontFamily: MONO }}>
          108,500.00
        </span>
      </div>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 90px 90px",
          padding: "10px 14px",
          fontSize: 11,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.08em",
          fontFamily: MONO,
          textTransform: "uppercase",
        }}
      >
        <span>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Total</span>
      </div>
      {/* Asks (top, descending) */}
      {asks.map((r, i) => <Row key={`a${i}`} r={r} />)}
      {/* Spread */}
      <div
        style={{
          padding: "10px 14px",
          background: "rgba(255,255,255,0.03)",
          fontFamily: MONO,
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span>SPREAD</span>
        <span>1.50 · 0.001%</span>
      </div>
      {/* Bids */}
      {bids.map((r, i) => <Row key={`b${i}`} r={r} />)}
    </div>
  );
};

/* ── Isometric funnel — money pile to silhouettes ──────────────── */
export const FunnelIso: React.FC<{
  fewMode: number; // 0 = many silhouettes, 1 = three silhouettes
  scale?: number;
}> = ({ fewMode, scale = 1 }) => {
  const manyOpacity = 1 - fewMode;
  const fewOpacity = fewMode;
  return (
    <svg width={840} height={520} viewBox="0 0 840 520" style={{ transform: `scale(${scale})` }}>
      <defs>
        <linearGradient id="funnel-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd400" />
          <stop offset="100%" stopColor="#ff8a00" />
        </linearGradient>
        <linearGradient id="funnel-rb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff3b3b" />
          <stop offset="50%" stopColor="#2cd36f" />
          <stop offset="100%" stopColor="#7e3bff" />
        </linearGradient>
      </defs>

      {/* Money pile (top) */}
      <ellipse cx="420" cy="60" rx="200" ry="38" fill="url(#funnel-gold)" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
      <rect x="220" y="52" width="400" height="20" fill="url(#funnel-gold)" opacity="0.85" />
      <ellipse cx="420" cy="76" rx="200" ry="38" fill="rgba(255,138,0,0.6)" />
      {[...Array(8)].map((_, i) => (
        <rect
          key={i}
          x={250 + i * 45}
          y={42 + (i % 2) * 4}
          width="38"
          height="10"
          rx="2"
          fill="#ffe066"
          stroke="rgba(0,0,0,0.25)"
          strokeWidth="0.8"
          transform={`rotate(${(i % 3 - 1) * 4} ${250 + i * 45 + 19} 47)`}
        />
      ))}

      {/* Funnel walls */}
      <path
        d="M 220 90 L 380 280 L 380 320 L 220 130 Z"
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
      />
      <path
        d="M 620 90 L 460 280 L 460 320 L 620 130 Z"
        fill="rgba(255,255,255,0.10)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
      />
      {/* Falling stream (rainbow) */}
      <rect x="385" y="280" width="70" height="80" fill="url(#funnel-rb)" opacity="0.7" />
      <rect x="385" y="280" width="70" height="80" fill="rgba(255,255,255,0.15)" />

      {/* Many silhouettes (8) — fade out */}
      <g opacity={manyOpacity}>
        {[...Array(8)].map((_, i) => {
          const x = 130 + i * 80;
          return (
            <g key={i} transform={`translate(${x},420)`}>
              <circle cx="0" cy="-30" r="14" fill="rgba(255,255,255,0.35)" />
              <path d="M -20 0 L 20 0 L 16 60 L -16 60 Z" fill="rgba(255,255,255,0.25)" />
            </g>
          );
        })}
      </g>

      {/* Three silhouettes (one center, rainbow-glowing) — fade in */}
      <g opacity={fewOpacity}>
        {[300, 420, 540].map((x, i) => {
          const isCenter = i === 1;
          return (
            <g key={i} transform={`translate(${x},420)`}>
              <circle
                cx="0"
                cy="-34"
                r="18"
                fill={isCenter ? "url(#funnel-rb)" : "rgba(255,255,255,0.55)"}
                style={isCenter ? { filter: "drop-shadow(0 0 14px rgba(126,59,255,0.7))" } : {}}
              />
              <path
                d="M -26 0 L 26 0 L 22 76 L -22 76 Z"
                fill={isCenter ? "url(#funnel-rb)" : "rgba(255,255,255,0.4)"}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
};

/* ── Mini PnL chart — for inside the gain-more circles ─────────────── */
export const MiniPnLChart: React.FC<{
  draw: number; // 0..1
  width?: number;
  height?: number;
}> = ({ draw, width = 320, height = 220 }) => {
  const points = [
    [0, 0.6], [0.08, 0.55], [0.16, 0.62], [0.24, 0.5], [0.32, 0.45],
    [0.42, 0.4], [0.52, 0.32], [0.62, 0.34], [0.72, 0.22], [0.82, 0.18],
    [0.92, 0.10], [1.0, 0.04],
  ] as const;
  const visible = Math.max(2, Math.ceil(points.length * draw));
  const path = points
    .slice(0, visible)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x * width} ${y * height}`)
    .join(" ");
  const last = points[visible - 1]!;
  const area = `${path} L ${last[0] * width} ${height} L 0 ${height} Z`;
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2cd36f" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#2cd36f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline */}
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {/* area */}
      <path d={area} fill="url(#pnl-fill)" />
      {/* line */}
      <path d={path} fill="none" stroke="#2cd36f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* head dot */}
      <circle cx={last[0] * width} cy={last[1] * height} r="5" fill="#2cd36f" />
      <circle cx={last[0] * width} cy={last[1] * height} r="10" fill="#2cd36f" opacity="0.25" />
      {/* axis labels */}
      <text x="6" y="14" fontFamily={MONO} fontSize="10" fill="rgba(255,255,255,0.45)" letterSpacing="0.06em">PNL · 30D</text>
      <text x={width - 50} y="14" fontFamily={MONO} fontSize="10" fill="#2cd36f" letterSpacing="0.06em">+47.2%</text>
    </svg>
  );
};

/* ── Ticker row — single asset row, scrolling ─────────────────── */
export const TickerRow: React.FC<{
  symbol: string;
  price: string;
  pct: string;
  positive: boolean;
  width?: number;
}> = ({ symbol, price, pct, positive, width = 1920 }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 22,
      padding: "10px 28px",
      width,
      whiteSpace: "nowrap",
      fontFamily,
      fontSize: 22,
      color: "rgba(255,255,255,0.65)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}
  >
    <span style={{ fontWeight: 800, color: "#fff", letterSpacing: "0.03em" }}>{symbol}</span>
    <span style={{ fontFamily: MONO, color: "#fff" }}>{price}</span>
    <span style={{ fontFamily: MONO, color: positive ? "#26a69a" : "#ef5350", fontWeight: 700 }}>
      {pct}
    </span>
  </div>
);

/* ── Mini market card — small thumbnail for starburst rays ───── */
export const MiniMarketCard: React.FC<{
  title: string;
  odds: string;
  brand: string;
  scale?: number;
}> = ({ title, odds, brand, scale = 1 }) => (
  <div
    style={{
      transform: `scale(${scale})`,
      transformOrigin: "center",
      width: 200,
      padding: "10px 12px",
      borderRadius: 10,
      background: "rgba(255,255,255,0.95)",
      border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 14px 30px rgba(0,0,0,0.18)",
      fontFamily,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: brand,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 9, color: "rgba(0,0,0,0.45)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Vision · Live
      </span>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color: "#000", lineHeight: 1.2, marginBottom: 8, minHeight: 32 }}>
      {title}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
      <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: "#000" }}>{odds}</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: "#26a69a", fontWeight: 700 }}>+0.4%</span>
    </div>
  </div>
);

/* ── Market name marquee — soft slow horizontal scroll ──────── */
export const MarketMarquee: React.FC<{
  items: ReadonlyArray<string>;
  speed?: number; // px / frame
  opacity?: number;
  y?: number; // vertical position px
}> = ({ items, speed = 0.6, opacity = 1, y = 0 }) => {
  const frame = useCurrentFrame();
  const offset = -frame * speed;
  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        height: 80,
        overflow: "hidden",
        opacity,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 80,
          transform: `translateX(${offset}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {[...items, ...items, ...items].map((label, i) => (
          <span
            key={i}
            style={{
              fontFamily,
              fontSize: 36,
              fontWeight: 400,
              fontStyle: "italic",
              color: "rgba(0,0,0,0.18)",
              letterSpacing: "-0.005em",
            }}
          >
            {label}
            <span style={{ marginLeft: 80, color: "rgba(0,0,0,0.10)" }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Corner prop wrapper — places a prop in a corner with float ─── */
export const CornerProp: React.FC<{
  children: React.ReactNode;
  corner: "tl" | "tr" | "bl" | "br";
  offset?: number;
  opacity?: number;
}> = ({ children, corner, offset = 80, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const float = Math.sin(frame * 0.04 + (corner === "tl" ? 0 : Math.PI)) * 6;
  const pos: React.CSSProperties = { position: "absolute", opacity };
  if (corner === "tl") { pos.top = offset; pos.left = offset; }
  if (corner === "tr") { pos.top = offset; pos.right = offset; }
  if (corner === "bl") { pos.bottom = offset; pos.left = offset; }
  if (corner === "br") { pos.bottom = offset; pos.right = offset; }
  return <div style={{ ...pos, transform: `translateY(${float}px)` }}>{children}</div>;
};

export const _RAINBOW_GRADIENT = RAINBOW;
