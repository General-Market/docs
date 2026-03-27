/**
 * SettlementsBarChart — Vertical bars, AI benchmark style
 *
 * Vision's 10-minute rounds: 144 settlements/day.
 * Every other market type is a sliver at the baseline.
 * The geometry is the argument.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLOR, FONT } from "./tokens";

// ── Data ──────────────────────────────────────────────────────────────

interface Bar {
  name: string;
  value: number;
  label: string;
  hero?: boolean;
}

const BARS: Bar[] = [
  { name: "Vision", value: 144, label: "144", hero: true },
  { name: "Crypto Perps", value: 3, label: "3" },
  { name: "Futures", value: 1, label: "1" },
  { name: "Options", value: 1, label: "1" },
  { name: "Prediction\nMarkets", value: 0.14, label: "~1/wk" },
];

// ── Layout ────────────────────────────────────────────────────────────

const HERO_COLOR = "#00C853";
const MUTED_COLOR = "#A0A0A0";

const BAR_W = 120;
const BAR_GAP = 60;
const BLOCK_W = BARS.length * BAR_W + (BARS.length - 1) * BAR_GAP; // 840
const BLOCK_LEFT = (1920 - BLOCK_W) / 2; // 540

const BASELINE = 860; // bottom of bars
const CEILING = 210; // top of tallest bar area
const CHART_H = BASELINE - CEILING; // 650

const MAX_VAL = 150;

// Horizontal grid values
const GRID_LINES = [0, 50, 100, 150];

function barHeight(value: number): number {
  return Math.max(6, (value / MAX_VAL) * CHART_H);
}

function gridY(value: number): number {
  return BASELINE - (value / MAX_VAL) * CHART_H;
}

// ── Component (fully static) ─────────────────────────────────────────

export const SettlementsBarChart: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
    {/* ── Title ──────────────────────────────────────────── */}
    <div
      style={{
        position: "absolute",
        top: 55,
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
      Settlements per Day
    </div>
    <div
      style={{
        position: "absolute",
        top: 112,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: 28,
        fontWeight: 500,
        color: COLOR.textSecondary,
      }}
    >
      Average Across All Markets
    </div>

    {/* ── Horizontal grid lines ──────────────────────────── */}
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
      {GRID_LINES.map((v) => {
        const y = gridY(v);
        return (
          <g key={`grid-${v}`}>
            <line
              x1={BLOCK_LEFT - 20}
              y1={y}
              x2={BLOCK_LEFT + BLOCK_W + 20}
              y2={y}
              stroke={COLOR.textMuted}
              strokeWidth={1}
              opacity={v === 0 ? 0.2 : 0.08}
            />
            {v > 0 && (
              <text
                x={BLOCK_LEFT - 30}
                y={y + 5}
                textAnchor="end"
                fontFamily="Geist, Inter, sans-serif"
                fontSize={18}
                fill={COLOR.textMuted}
              >
                {v}
              </text>
            )}
          </g>
        );
      })}
    </svg>

    {/* ── Bars ───────────────────────────────────────────── */}
    {BARS.map((bar, i) => {
      const x = BLOCK_LEFT + i * (BAR_W + BAR_GAP);
      const h = barHeight(bar.value);
      const y = BASELINE - h;
      const color = bar.hero ? HERO_COLOR : MUTED_COLOR;

      return (
        <React.Fragment key={bar.name}>
          {/* Bar */}
          <div
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: BAR_W,
              height: h,
              backgroundColor: color,
              borderRadius: "6px 6px 0 0",
              opacity: bar.hero ? 1 : 0.5,
            }}
          />

          {/* Value label — above bar */}
          <div
            style={{
              position: "absolute",
              left: x,
              top: y - 36,
              width: BAR_W,
              textAlign: "center",
              fontFamily: FONT.sans,
              fontSize: bar.hero ? 28 : 22,
              fontWeight: bar.hero ? 700 : 500,
              color: bar.hero ? HERO_COLOR : COLOR.textMuted,
            }}
          >
            {bar.label}
          </div>

          {/* Category label — below baseline */}
          <div
            style={{
              position: "absolute",
              left: x,
              top: BASELINE + 16,
              width: BAR_W,
              textAlign: "center",
              fontFamily: FONT.sans,
              fontSize: 20,
              fontWeight: bar.hero ? 600 : 500,
              color: bar.hero ? COLOR.textPrimary : COLOR.textSecondary,
              lineHeight: 1.25,
              whiteSpace: "pre-line",
            }}
          >
            {bar.name}
          </div>
        </React.Fragment>
      );
    })}

    {/* ── Footnote ───────────────────────────────────────── */}
    <div
      style={{
        position: "absolute",
        bottom: 45,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: 20,
        fontWeight: 400,
        color: COLOR.textMuted,
      }}
    >
      Vision uses 10-minute settlement rounds — 144 per day
    </div>
  </AbsoluteFill>
);
