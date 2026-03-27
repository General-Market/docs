/**
 * CostMarketsScene — Static scatter plot for VisionVC2 ending
 *
 * X = Fee cost for 1M positions at min trade size (left = cheap)
 * Y = Number of markets (top = more)
 * Both axes linear. GM at 580K towers over everything else.
 *
 * Fee data verified 2026-03-27 from official fee pages.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLOR, FONT } from "./tokens";

// ── Data ──────────────────────────────────────────────────────────────
// Cost = fee_per_min_trade × 1,000,000 positions
//
// Bitget:      0.10% taker on $2 min = $0.002/trade  → $2,000
// Binance:     0.10% taker on $5 min = $0.005/trade  → $5,000
// Polymarket:  dynamic curve ~1% avg on $1 contract   → $10,000
// Pump.fun:    1.25% on ~$1 bonding curve buy         → $12,500
// Kalshi:      $0.02/contract flat                    → $20,000
// Coinbase:    1.20% taker (Intro 1) on $2 min        → $24,000
// GM:          parimutuel, $0                         → $0

interface Platform {
  name: string;
  markets: number;
  cost: number;
  color: string;
  filled?: boolean;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

const PLATFORMS: Platform[] = [
  {
    name: "Bitget",
    markets: 800,
    cost: 2_000,
    color: "#00B8A9",
    labelOffsetX: 16,
    labelOffsetY: 12,
  },
  {
    name: "Binance",
    markets: 1_600,
    cost: 5_000,
    color: "#D4A017",
    labelOffsetX: 16,
    labelOffsetY: -28,
  },
  {
    name: "Polymarket",
    markets: 36_000,
    cost: 10_000,
    color: "#7B68EE",
    labelOffsetX: 16,
    labelOffsetY: -10,
  },
  {
    name: "Pump.fun",
    markets: 95_500,
    cost: 12_500,
    color: "#7CB342",
    labelOffsetX: 16,
    labelOffsetY: -10,
  },
  {
    name: "Kalshi",
    markets: 35_000,
    cost: 20_000,
    color: "#FF5722",
    labelOffsetX: 16,
    labelOffsetY: 12,
  },
  {
    name: "Coinbase",
    markets: 300,
    cost: 24_000,
    color: "#0052FF",
    labelOffsetX: 16,
    labelOffsetY: -28,
  },
  {
    name: "General Market",
    markets: 580_000,
    cost: 0,
    color: "#00C853",
    filled: true,
    labelOffsetX: 22,
    labelOffsetY: -10,
  },
];

// ── Chart geometry ────────────────────────────────────────────────────

const CHART = { left: 260, right: 1780, top: 180, bottom: 920 };
const W = CHART.right - CHART.left;
const H = CHART.bottom - CHART.top;

// X: linear — fee cost for 1M positions
const X_MAX = 30_000;

function xPos(cost: number): number {
  return CHART.left + (cost / X_MAX) * W;
}

// Y: linear — number of markets
const Y_MAX = 620_000;

function yPos(markets: number): number {
  return CHART.bottom - (markets / Y_MAX) * H;
}

// Axis ticks
const X_TICKS = [
  { v: 0, l: "$0" },
  { v: 10_000, l: "$10K" },
  { v: 20_000, l: "$20K" },
  { v: 30_000, l: "$30K" },
];

const Y_TICKS = [
  { v: 0, l: "0" },
  { v: 100_000, l: "100K" },
  { v: 200_000, l: "200K" },
  { v: 300_000, l: "300K" },
  { v: 400_000, l: "400K" },
  { v: 500_000, l: "500K" },
  { v: 600_000, l: "600K" },
];

// ── Component (fully static) ─────────────────────────────────────────

export const CostMarketsScene: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
    {/* ── Title ──────────────────────────────────────────── */}
    <div
      style={{
        position: "absolute",
        top: 45,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: 44,
        fontWeight: 600,
        color: COLOR.textPrimary,
        letterSpacing: "-0.02em",
      }}
    >
      Fee Cost for 1M Positions vs Number of Markets
    </div>
    <div
      style={{
        position: "absolute",
        top: 100,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: 28,
        fontWeight: 500,
        color: COLOR.textSecondary,
      }}
    >
      Each Position at Minimum Trade Size
    </div>

    {/* ── Y-axis label ──────────────────────────────────── */}
    <div
      style={{
        position: "absolute",
        left: 90 - H / 2,
        top: CHART.top + H / 2 - 12,
        width: H,
        height: 24,
        textAlign: "center",
        transform: "rotate(-90deg)",
        fontFamily: FONT.sans,
        fontSize: 24,
        fontWeight: 500,
        color: COLOR.textSecondary,
        whiteSpace: "nowrap",
      }}
    >
      Number of Markets
    </div>

    {/* ── X-axis label ──────────────────────────────────── */}
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: CHART.left,
        width: W,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: 24,
        fontWeight: 500,
        color: COLOR.textSecondary,
      }}
    >
      Fee Cost for 1M Positions
    </div>

    {/* ── SVG: axes + gridlines ─────────────────────────── */}
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        pointerEvents: "none",
      }}
    >
      {/* Axis lines */}
      <line
        x1={CHART.left} y1={CHART.bottom} x2={CHART.right} y2={CHART.bottom}
        stroke={COLOR.textMuted} strokeWidth={1} opacity={0.35}
      />
      <line
        x1={CHART.left} y1={CHART.top} x2={CHART.left} y2={CHART.bottom}
        stroke={COLOR.textMuted} strokeWidth={1} opacity={0.35}
      />

      {/* X ticks + gridlines */}
      {X_TICKS.map((t) => {
        const x = xPos(t.v);
        return (
          <g key={`x-${t.v}`}>
            {t.v > 0 && (
              <line
                x1={x} y1={CHART.top} x2={x} y2={CHART.bottom}
                stroke={COLOR.textMuted} strokeWidth={1}
                opacity={0.06} strokeDasharray="4 6"
              />
            )}
            <line
              x1={x} y1={CHART.bottom} x2={x} y2={CHART.bottom + 6}
              stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3}
            />
            <text
              x={x} y={CHART.bottom + 30} textAnchor="middle"
              fontFamily="Geist, Inter, sans-serif" fontSize={22}
              fill={COLOR.textSecondary}
            >
              {t.l}
            </text>
          </g>
        );
      })}

      {/* Y ticks + gridlines */}
      {Y_TICKS.map((t) => {
        const y = yPos(t.v);
        return (
          <g key={`y-${t.v}`}>
            {t.v > 0 && (
              <line
                x1={CHART.left} y1={y} x2={CHART.right} y2={y}
                stroke={COLOR.textMuted} strokeWidth={1}
                opacity={0.06} strokeDasharray="4 6"
              />
            )}
            <line
              x1={CHART.left - 6} y1={y} x2={CHART.left} y2={y}
              stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3}
            />
            <text
              x={CHART.left - 14} y={y + 6} textAnchor="end"
              fontFamily="Geist, Inter, sans-serif" fontSize={22}
              fill={COLOR.textSecondary}
            >
              {t.l}
            </text>
          </g>
        );
      })}
    </svg>

    {/* ── Data points ───────────────────────────────────── */}
    {PLATFORMS.map((p) => {
      const cx = xPos(p.cost);
      const cy = yPos(p.markets);
      const r = p.filled ? 14 : 10;

      return (
        <React.Fragment key={p.name}>
          {/* Dot */}
          <div
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              backgroundColor: p.filled ? p.color : "transparent",
              border: p.filled ? "none" : `3px solid ${p.color}`,
              boxShadow: p.filled ? `0 0 20px ${p.color}60` : "none",
            }}
          />

          {/* Label */}
          <div
            style={{
              position: "absolute",
              left: cx + (p.labelOffsetX ?? 16),
              top: cy + (p.labelOffsetY ?? -10),
              fontFamily: FONT.sans,
              fontSize: p.filled ? 26 : 22,
              fontWeight: p.filled ? 700 : 500,
              color: p.color,
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </div>
        </React.Fragment>
      );
    })}
  </AbsoluteFill>
);
